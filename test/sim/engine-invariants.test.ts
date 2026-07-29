import { describe, expect, it } from "vitest";
import { cityById } from "../../sim/cities.ts";
import { ACT_BUCKETS, BUCKET_MS, GLOBAL_SEED } from "../../sim/constants.ts";
import { generateBucket, simulateRange } from "../../sim/engine.ts";
import { FLAG_THRESHOLD } from "../../sim/types.ts";

const SAMPLE_BUCKETS = Array.from({ length: 100 }, (_, i) => 357056600 + i);

describe("engine invariants", () => {
	it("holds structural invariants across 100 sampled buckets", () => {
		for (const bucketIndex of SAMPLE_BUCKETS) {
			const txns = generateBucket(GLOBAL_SEED, bucketIndex);
			expect(txns.length).toBeGreaterThanOrEqual(3);

			const ids = new Set<string>();
			let lastTs = Number.NEGATIVE_INFINITY;
			for (const t of txns) {
				expect(t.id).toMatch(/^[0-9a-f]+-[0-9a-f]{8}$/);
				ids.add(t.id);

				expect(t.ts).toBeGreaterThanOrEqual(bucketIndex * BUCKET_MS);
				expect(t.ts).toBeLessThan((bucketIndex + 1) * BUCKET_MS);
				expect(t.ts).toBeGreaterThanOrEqual(lastTs);
				lastTs = t.ts;

				expect(t.riskScore).toBeGreaterThanOrEqual(0);
				expect(t.riskScore).toBeLessThanOrEqual(1);
				// Exactly two decimals.
				expect(Math.round(t.riskScore * 100) / 100).toBe(t.riskScore);
				expect(t.flagged).toBe(t.riskScore >= FLAG_THRESHOLD);

				expect(Number.isInteger(t.amountMinor)).toBe(true);
				expect(t.amountMinor).toBeGreaterThanOrEqual(1);
				expect(Number.isInteger(t.usdMinor)).toBe(true);
				expect(t.usdMinor).toBeGreaterThanOrEqual(1);

				// Cities must resolve (throws on unknown id).
				expect(cityById(t.fromCity).currency).toBe(t.currency);
				cityById(t.toCity);
				expect(t.fromCity).not.toBe(t.toCity);
			}
			expect(ids.size).toBe(txns.length);
		}
	});

	it("stages fraud in every act (demo pacing is designed-in)", () => {
		for (let act = 0; act < 6; act++) {
			const txns = simulateRange(
				GLOBAL_SEED,
				act * ACT_BUCKETS,
				(act + 1) * ACT_BUCKETS - 1,
			);
			const fraud = txns.filter((t) => t.fraudPattern !== null);
			expect(fraud.length).toBeGreaterThan(0);
			// Detection must eventually trip within the act.
			expect(fraud.some((t) => t.flagged)).toBe(true);
		}
	});
});
