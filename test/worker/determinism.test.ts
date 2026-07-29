import { describe, expect, it } from "vitest";
import { GLOBAL_SEED } from "../../sim/constants.ts";
import { generateBucket } from "../../sim/engine.ts";
import { episodesForAct } from "../../sim/episodes.ts";
import { aggregateRange } from "../../sim/kpi.ts";
import { fnv1a, REFERENCE } from "../helpers/reference.ts";

/**
 * THE cross-runtime test: this file runs inside real workerd. The hashes it
 * asserts are the same constants the node pool asserts — if both pools pass,
 * the Worker and the browser compute the identical world.
 */
describe("determinism (workerd runtime)", () => {
	it("matches the locked reference hashes bit-for-bit", () => {
		expect(fnv1a(JSON.stringify(generateBucket(GLOBAL_SEED, 12345)))).toBe(
			REFERENCE.bucket12345,
		);
		expect(fnv1a(JSON.stringify(generateBucket(GLOBAL_SEED, 357056640)))).toBe(
			REFERENCE.bucket357056640,
		);
		expect(fnv1a(JSON.stringify(generateBucket(GLOBAL_SEED, 51)))).toBe(
			REFERENCE.bucket51,
		);
		expect(fnv1a(JSON.stringify(episodesForAct(GLOBAL_SEED, 2975472)))).toBe(
			REFERENCE.episodesAct2975472,
		);
		expect(fnv1a(JSON.stringify(aggregateRange(GLOBAL_SEED, 0, 119)))).toBe(
			REFERENCE.kpiAct0,
		);
	});
});
