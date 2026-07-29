import { CITIES } from "./cities.ts";
import { ACT_BUCKETS } from "./constants.ts";
import {
	combine,
	mix32,
	pickWeighted,
	rangeInt,
	STREAM,
	streamRng,
} from "./prng.ts";
import type { EpisodeSpec, FraudPatternId } from "./types.ts";

/**
 * Fraud-episode scheduler. Time divides into 10-minute acts; each act
 * deterministically stages 1–3 episodes. Demo pacing is designed-in: there is
 * ALWAYS something to point at within ten minutes, and it is the same
 * something for every viewer.
 *
 * Episode start offsets are capped at 55 buckets so even the longest pattern
 * (structuring, 60 buckets) finishes inside its act.
 */

const PATTERN_ORDER: readonly FraudPatternId[] = [
	"card_testing",
	"account_takeover",
	"mule_fanout",
	"structuring",
];

export function episodesForAct(seed: number, actIndex: number): EpisodeSpec[] {
	const rng = streamRng(seed, actIndex, STREAM.episodes);
	let count = 1;
	if (rng() < 0.55) {
		count++;
	}
	if (rng() < 0.25) {
		count++;
	}

	const episodes: EpisodeSpec[] = [];
	for (let i = 0; i < count; i++) {
		const pattern = PATTERN_ORDER[rangeInt(rng, 0, PATTERN_ORDER.length - 1)];
		const origin = pickWeighted(rng, CITIES, (c) => c.weight);
		const target = pickWeighted(rng, CITIES, (c) =>
			c.id === origin.id ? 0 : c.weight,
		);
		episodes.push({
			pattern,
			actIndex,
			startBucket: actIndex * ACT_BUCKETS + rangeInt(rng, 0, 55),
			seed: mix32(combine(combine(seed, actIndex), i + 1)),
			originCity: origin.id,
			targetCity: target.id,
			intensity: rangeInt(rng, 1, 3),
		});
	}
	return episodes;
}
