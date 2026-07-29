import { generateBaseline } from "./baseline.ts";
import { ACT_BUCKETS } from "./constants.ts";
import { episodesForAct, patternDuration } from "./episodes.ts";
import * as accountTakeover from "./patterns/account-takeover.ts";
import * as cardTesting from "./patterns/card-testing.ts";
import * as muleFanout from "./patterns/mule-fanout.ts";
import * as structuring from "./patterns/structuring.ts";
import { combine, STREAM } from "./prng.ts";
import type {
	EpisodeSpec,
	FraudPatternId,
	Transaction,
	TxnDraft,
} from "./types.ts";

/**
 * The engine: one bucket of world traffic = baseline + active fraud episodes,
 * with stable ids stamped in draft order (draft order is itself deterministic)
 * and the result sorted by timestamp for smooth playback.
 */

interface Pattern {
	readonly DURATION: number;
	emit(spec: EpisodeSpec, bucketIndex: number): TxnDraft[];
}

const PATTERNS: Readonly<Record<FraudPatternId, Pattern>> = {
	card_testing: cardTesting,
	account_takeover: accountTakeover,
	mule_fanout: muleFanout,
	structuring,
};

function isActive(spec: EpisodeSpec, bucketIndex: number): boolean {
	return (
		bucketIndex >= spec.startBucket &&
		bucketIndex < spec.startBucket + patternDuration(spec.pattern)
	);
}

/** Every transaction one episode emits over its full run (drafts, no ids). */
export function episodeTransactions(spec: EpisodeSpec): TxnDraft[] {
	const out: TxnDraft[] = [];
	const end = spec.startBucket + patternDuration(spec.pattern);
	for (let b = spec.startBucket; b < end; b++) {
		out.push(...PATTERNS[spec.pattern].emit(spec, b));
	}
	return out;
}

export function generateBucket(
	seed: number,
	bucketIndex: number,
): Transaction[] {
	const drafts: TxnDraft[] = generateBaseline(seed, bucketIndex);
	const actIndex = Math.floor(bucketIndex / ACT_BUCKETS);
	for (const spec of episodesForAct(seed, actIndex)) {
		if (isActive(spec, bucketIndex)) {
			drafts.push(...PATTERNS[spec.pattern].emit(spec, bucketIndex));
		}
	}

	const idBase = combine(combine(seed, STREAM.ids), bucketIndex);
	const bucketHex = bucketIndex.toString(16);
	const txns: Transaction[] = drafts.map((draft, i) => ({
		...draft,
		id: `${bucketHex}-${combine(idBase, i).toString(16).padStart(8, "0")}`,
	}));
	txns.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return txns;
}

/** Inclusive bucket range, concatenated in order. */
export function simulateRange(
	seed: number,
	fromBucket: number,
	toBucket: number,
): Transaction[] {
	const out: Transaction[] = [];
	for (let b = fromBucket; b <= toBucket; b++) {
		out.push(...generateBucket(seed, b));
	}
	return out;
}
