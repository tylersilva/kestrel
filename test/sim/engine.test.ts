import { describe, expect, it } from "vitest";
import {
	BUCKET_MS,
	bucketIndexFor,
	ENGINE_VERSION,
	GLOBAL_SEED,
} from "../../sim/index.ts";

describe("sim contract", () => {
	it("exposes stable engine constants", () => {
		expect(GLOBAL_SEED).toBeTypeOf("number");
		expect(BUCKET_MS).toBe(5000);
		expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("maps timestamps to buckets deterministically", () => {
		expect(bucketIndexFor(0)).toBe(0);
		expect(bucketIndexFor(4999)).toBe(0);
		expect(bucketIndexFor(5000)).toBe(1);
		expect(bucketIndexFor(1_753_750_000_123)).toBe(
			Math.floor(1_753_750_000_123 / 5000),
		);
	});
});
