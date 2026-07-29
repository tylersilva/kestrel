import { mix32 } from "../prng.ts";
import type { EpisodeSpec, TxnDraft } from "../types.ts";
import { episodeRng, fraudTxn } from "./util.ts";

/**
 * Cross-border structuring ("smurfing"): repeated wires each kept just under
 * the $10k reporting threshold, one every 10–20 seconds on the same corridor.
 * Individually boring; cumulatively unmistakable — risk climbs with each hop.
 */

export const DURATION = 60;

export function emit(spec: EpisodeSpec, bucketIndex: number): TxnDraft[] {
	const rel = bucketIndex - spec.startBucket;
	// Per-episode cadence: a wire every 2–4 buckets.
	const gap = 2 + (mix32(spec.seed) % 3);
	if (rel % gap !== 0) {
		return [];
	}
	const n = rel / gap; // how many wires have already gone through
	const rng = episodeRng(spec.seed, rel);
	return [
		fraudTxn({
			rng,
			bucketIndex,
			fromCity: spec.originCity,
			toCity: spec.targetCity,
			usdMinor: 920_000 + Math.floor(rng() * 70_001), // $9,200–$9,900
			channel: "wire",
			risk: Math.min(0.92, 0.64 + n * 0.04) + rng() * 0.03,
			pattern: "structuring",
		}),
	];
}
