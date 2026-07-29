import { describe, expect, it } from "vitest";
import { GLOBAL_SEED } from "../../sim/constants.ts";
import { simulateRange } from "../../sim/engine.ts";
import { aggregateRange } from "../../sim/kpi.ts";

describe("kpi aggregation", () => {
	it("agrees with manual accumulation over the raw stream", () => {
		const kpi = aggregateRange(GLOBAL_SEED, 500, 619);
		const txns = simulateRange(GLOBAL_SEED, 500, 619);

		expect(kpi.txnCount).toBe(txns.length);
		expect(kpi.volumeUsdMinor).toBe(
			txns.reduce((sum, t) => sum + t.usdMinor, 0),
		);
		expect(kpi.flaggedCount).toBe(txns.filter((t) => t.flagged).length);
		expect(kpi.fraudCount).toBe(
			txns.filter((t) => t.fraudPattern !== null).length,
		);
		expect(kpi.fraudCaught + kpi.missedFraud).toBe(kpi.fraudCount);
		expect(kpi.falsePositives).toBe(
			txns.filter((t) => t.flagged && t.fraudPattern === null).length,
		);
	});

	it("keeps detection rates honest over an hour of world time", () => {
		const kpi = aggregateRange(GLOBAL_SEED, 0, 719);
		const legit = kpi.txnCount - kpi.fraudCount;

		// False positives: deterministic ~1.5% of legit traffic.
		expect(kpi.falsePositives / legit).toBeGreaterThan(0.005);
		expect(kpi.falsePositives / legit).toBeLessThan(0.03);

		// Per-txn catch rate: ramp phases miss by design, majority caught.
		expect(kpi.fraudCaught / kpi.fraudCount).toBeGreaterThan(0.5);
		expect(kpi.missedFraud / kpi.fraudCount).toBeLessThan(0.45);
	});

	it("replays a full simulated day fast enough for page load", () => {
		const start = performance.now();
		const kpi = aggregateRange(GLOBAL_SEED, 0, 17_279);
		const elapsed = performance.now() - start;

		expect(kpi.txnCount).toBeGreaterThan(100_000);
		// Generous CI budget; locally this runs in ~600ms.
		expect(elapsed).toBeLessThan(3_000);
	});
});
