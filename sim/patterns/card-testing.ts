import type { EpisodeSpec, TxnDraft } from "../types.ts";
import { episodeRng, fraudTxn } from "./util.ts";

/**
 * Card-testing burst: a stolen-card batch is probed against one merchant —
 * a rapid stream of tiny card-not-present charges on a single corridor,
 * risk ramping as velocity rules trip. Globe read: thin rapid arcs turning red.
 */

export const DURATION = 6;

export function emit(spec: EpisodeSpec, bucketIndex: number): TxnDraft[] {
	const rel = bucketIndex - spec.startBucket;
	const rng = episodeRng(spec.seed, rel);
	const count = 2 + spec.intensity + Math.floor(rng() * 3); // 3..8 per bucket
	const progress = rel / (DURATION - 1);

	const txns: TxnDraft[] = [];
	for (let i = 0; i < count; i++) {
		const usdMinor = 50 + Math.floor(rng() * 451); // $0.50–$5.00
		txns.push(
			fraudTxn({
				rng,
				bucketIndex,
				fromCity: spec.originCity,
				toCity: spec.targetCity,
				usdMinor,
				channel: "card_not_present",
				risk: 0.62 + 0.32 * progress + rng() * 0.08,
				pattern: "card_testing",
			}),
		);
	}
	return txns;
}
