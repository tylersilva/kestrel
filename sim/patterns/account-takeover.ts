import type { EpisodeSpec, TxnDraft } from "../types.ts";
import { episodeRng, fraudTxn } from "./util.ts";

/**
 * Account takeover: a small "verification" probe, then — once the attacker
 * trusts the access — one large wire out through an unusual corridor.
 * Globe read: a faint arc followed by a single heavy red arc.
 */

export const DURATION = 5;

export function emit(spec: EpisodeSpec, bucketIndex: number): TxnDraft[] {
	const rel = bucketIndex - spec.startBucket;
	const rng = episodeRng(spec.seed, rel);

	if (rel === 0) {
		// The probe is designed to slip through — sub-threshold by design.
		return [
			fraudTxn({
				rng,
				bucketIndex,
				fromCity: spec.originCity,
				toCity: spec.targetCity,
				usdMinor: 100 + Math.floor(rng() * 801), // $1–$9
				channel: "card_not_present",
				risk: 0.45 + rng() * 0.15,
				pattern: "account_takeover",
				detectable: false,
			}),
		];
	}

	if (rel === 3) {
		return [
			fraudTxn({
				rng,
				bucketIndex,
				fromCity: spec.originCity,
				toCity: spec.targetCity,
				usdMinor: 2_500_000 + Math.floor(rng() * 15_500_001), // $25k–$180k
				channel: "wire",
				risk: 0.85 + rng() * 0.12,
				pattern: "account_takeover",
			}),
		];
	}

	return [];
}
