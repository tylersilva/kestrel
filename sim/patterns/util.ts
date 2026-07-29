import { cityById } from "../cities.ts";
import { BUCKET_MS } from "../constants.ts";
import { localize } from "../fx.ts";
import { combine, mulberry32, type Rng, round2 } from "../prng.ts";
import {
	type Channel,
	FLAG_THRESHOLD,
	type FraudPatternId,
	type TxnDraft,
} from "../types.ts";

/** Each (episode, relative-bucket) pair gets its own independent stream. */
export function episodeRng(seed: number, rel: number): Rng {
	return mulberry32(combine(seed, rel));
}

export interface FraudTxnArgs {
	readonly rng: Rng;
	readonly bucketIndex: number;
	readonly fromCity: string;
	readonly toCity: string;
	readonly usdMinor: number;
	readonly channel: Channel;
	/** Target risk before the miss roll. */
	readonly risk: number;
	readonly pattern: FraudPatternId;
	/** false = designed sub-threshold txn (no miss roll), capped below flag. */
	readonly detectable?: boolean;
}

/**
 * Build a fraud transaction. Draw order is FIXED: ts offset, then miss roll.
 * ~8% of detectable fraud slips under the threshold (missed fraud) — that is
 * what keeps the KPI story honest.
 */
export function fraudTxn(args: FraudTxnArgs): TxnDraft {
	const ts = args.bucketIndex * BUCKET_MS + Math.floor(args.rng() * BUCKET_MS);
	let risk: number;
	if (args.detectable === false) {
		risk = Math.min(args.risk, FLAG_THRESHOLD - 0.02);
	} else {
		const missed = args.rng() < 0.08;
		risk = missed ? Math.min(args.risk, FLAG_THRESHOLD - 0.01) : args.risk;
	}
	risk = round2(Math.min(0.99, Math.max(0.05, risk)));
	const money = localize(args.usdMinor, cityById(args.fromCity).currency);
	return {
		ts,
		fromCity: args.fromCity,
		toCity: args.toCity,
		amountMinor: money.amountMinor,
		currency: money.currency,
		usdMinor: args.usdMinor,
		channel: args.channel,
		riskScore: risk,
		flagged: risk >= FLAG_THRESHOLD,
		fraudPattern: args.pattern,
	};
}
