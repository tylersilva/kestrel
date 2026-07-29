import { CITIES } from "./cities.ts";
import { ACT_BUCKETS } from "./constants.ts";
import { DURATION as ACCOUNT_TAKEOVER_DURATION } from "./patterns/account-takeover.ts";
import { DURATION as CARD_TESTING_DURATION } from "./patterns/card-testing.ts";
import { DURATION as MULE_FANOUT_DURATION } from "./patterns/mule-fanout.ts";
import { DURATION as STRUCTURING_DURATION } from "./patterns/structuring.ts";
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
 * Start offsets are capped per pattern at ACT_BUCKETS - duration, so every
 * episode provably finishes inside its act — generateBucket only consults the
 * current act's schedule.
 */

const DURATIONS: Readonly<Record<FraudPatternId, number>> = {
	card_testing: CARD_TESTING_DURATION,
	account_takeover: ACCOUNT_TAKEOVER_DURATION,
	mule_fanout: MULE_FANOUT_DURATION,
	structuring: STRUCTURING_DURATION,
};

export function patternDuration(pattern: FraudPatternId): number {
	return DURATIONS[pattern];
}

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
		// Structuring is cross-border by definition — different-currency
		// corridors only (the closest deterministic proxy for "different
		// country" without a country field).
		const crossCurrencyOnly = pattern === "structuring";
		const target = pickWeighted(rng, CITIES, (c) => {
			if (c.id === origin.id) {
				return 0;
			}
			if (crossCurrencyOnly && c.currency === origin.currency) {
				return 0;
			}
			return c.weight;
		});
		episodes.push({
			pattern,
			actIndex,
			startBucket:
				actIndex * ACT_BUCKETS +
				rangeInt(rng, 0, ACT_BUCKETS - DURATIONS[pattern]),
			seed: mix32(combine(combine(seed, actIndex), i + 1)),
			originCity: origin.id,
			targetCity: target.id,
			intensity: rangeInt(rng, 1, 3),
		});
	}
	return episodes;
}
