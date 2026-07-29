import { describe, expect, it } from "vitest";
import { GLOBAL_SEED } from "../../sim/constants.ts";
import { generateBucket } from "../../sim/engine.ts";
import { episodesForAct } from "../../sim/episodes.ts";
import { aggregateRange } from "../../sim/kpi.ts";
import { fnv1a, REFERENCE } from "../helpers/reference.ts";

describe("determinism (node runtime)", () => {
	it("same (seed, bucket) ⇒ identical output on repeat calls", () => {
		const a = generateBucket(GLOBAL_SEED, 777);
		const b = generateBucket(GLOBAL_SEED, 777);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		expect(a).toEqual(b);
	});

	it("matches the locked reference hashes", () => {
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

	it("different seeds ⇒ different worlds", () => {
		const a = generateBucket(GLOBAL_SEED, 12345);
		const b = generateBucket(GLOBAL_SEED + 1, 12345);
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});
});
