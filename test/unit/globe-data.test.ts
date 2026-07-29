import { describe, expect, it } from "vitest";
import {
	GLOBAL_SEED,
	generateBucket,
	type Transaction,
} from "../../sim/index.ts";
import {
	ARC_TTL_MS,
	capArcs,
	type GlobeArc,
	pruneByTtl,
	QUALITY,
	txnToArc,
	txnToRing,
} from "../../src/lib/globe-data.ts";

// Bucket 102 carries flagged transactions under the current ENGINE_VERSION.
const sample = (): Transaction[] => generateBucket(GLOBAL_SEED, 102);

describe("globe data mapping", () => {
	it("maps transactions to arcs with city coordinates and risk colors", () => {
		for (const txn of sample()) {
			const arc = txnToArc(txn, 1_000);
			expect(arc.id).toBe(txn.id);
			expect(arc.startLat).toBeGreaterThanOrEqual(-90);
			expect(arc.startLat).toBeLessThanOrEqual(90);
			expect(Math.abs(arc.startLng)).toBeLessThanOrEqual(180);
			expect(arc.risk).toBe(txn.riskScore);
			if (txn.riskScore >= 0.8) {
				expect(arc.color).toContain("255, 77, 94"); // alert red
			}
			expect(arc.stroke).toBeGreaterThan(0);
			expect(arc.bornAt).toBe(1_000);
		}
	});

	it("widens stroke with USD magnitude", () => {
		const txns = sample();
		const base = txnToArc({ ...txns[0], usdMinor: 500 }, 0);
		const big = txnToArc({ ...txns[0], usdMinor: 200_000_000 }, 0);
		expect(big.stroke).toBeGreaterThan(base.stroke);
	});

	it("rings only for flagged transactions, at the destination", () => {
		let flaggedSeen = 0;
		for (const txn of sample()) {
			const ring = txnToRing(txn, 0);
			if (txn.flagged) {
				flaggedSeen++;
				expect(ring).not.toBeNull();
				expect(ring?.id).toBe(`ring-${txn.id}`);
			} else {
				expect(ring).toBeNull();
			}
		}
		expect(flaggedSeen).toBeGreaterThan(0); // bucket 102 has flagged txns
	});

	it("prunes by TTL with an exact boundary", () => {
		const arcs = sample().map((t) => txnToArc(t, 0));
		expect(pruneByTtl(arcs, ARC_TTL_MS - 1, ARC_TTL_MS)).toHaveLength(
			arcs.length,
		);
		expect(pruneByTtl(arcs, ARC_TTL_MS, ARC_TTL_MS)).toHaveLength(0);
	});

	it("caps arcs by dropping the lowest risk first", () => {
		const arcs: GlobeArc[] = sample().map((t) => txnToArc(t, 0));
		const capped = capArcs(arcs, 5);
		expect(capped).toHaveLength(5);
		const minKept = Math.min(...capped.map((a) => a.risk));
		const dropped = arcs.filter((a) => !capped.some((c) => c.id === a.id));
		for (const arc of dropped) {
			expect(arc.risk).toBeLessThanOrEqual(minKept);
		}
	});

	it("low quality halves the arc budget", () => {
		expect(QUALITY.low.arcCap).toBeLessThan(QUALITY.high.arcCap);
		expect(QUALITY.low.hexResolution).toBeLessThan(QUALITY.high.hexResolution);
	});
});
