import { describe, expect, it } from "vitest";
import { GLOBAL_SEED, generateBucket } from "../../sim/index.ts";
import { aggregateRange } from "../../sim/kpi.ts";
import { useSimStore } from "../../src/store/sim-store.ts";

describe("sim-store KPI accounting", () => {
	it("folding buckets through applyBucket matches aggregateRange exactly", () => {
		const FROM = 240;
		const TO = 479; // two full acts
		useSimStore.getState().resetDay();

		for (let b = FROM; b <= TO; b++) {
			useSimStore.getState().applyBucket(b, generateBucket(GLOBAL_SEED, b));
		}

		const kpi = useSimStore.getState().kpi;
		const reference = aggregateRange(GLOBAL_SEED, FROM, TO);

		expect(kpi.txnCount).toBe(reference.txnCount);
		expect(kpi.volumeUsdMinor).toBe(reference.volumeUsdMinor);
		expect(kpi.flaggedCount).toBe(reference.flaggedCount);
		expect(kpi.fraudCount).toBe(reference.fraudCount);
		expect(kpi.fraudCaught).toBe(reference.fraudCaught);
		expect(kpi.fraudCaughtUsdMinor).toBe(reference.fraudCaughtUsdMinor);
		expect(kpi.falsePositives).toBe(reference.falsePositives);
		expect(kpi.missedFraud).toBe(reference.missedFraud);
		expect(kpi.episodesTotal).toBe(reference.episodesTotal);
		expect(kpi.episodesDetected).toBe(reference.episodesDetected);
	});
});
