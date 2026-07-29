import { generateBucket } from "./engine.ts";
import type { KpiSnapshot } from "./types.ts";

/**
 * KPI aggregation runs the exact same generation path as the live stream —
 * consistency by construction. There is deliberately no separate "fast stats"
 * implementation to drift out of sync; a full simulated day aggregates in
 * well under a second (see the perf test).
 */
export function aggregateRange(
	seed: number,
	fromBucket: number,
	toBucket: number,
): KpiSnapshot {
	let txnCount = 0;
	let volumeUsdMinor = 0;
	let flaggedCount = 0;
	let fraudCount = 0;
	let fraudCaught = 0;
	let fraudCaughtUsdMinor = 0;
	let falsePositives = 0;
	let missedFraud = 0;

	for (let b = fromBucket; b <= toBucket; b++) {
		for (const txn of generateBucket(seed, b)) {
			txnCount++;
			volumeUsdMinor += txn.usdMinor;
			if (txn.flagged) {
				flaggedCount++;
			}
			if (txn.fraudPattern !== null) {
				fraudCount++;
				if (txn.flagged) {
					fraudCaught++;
					fraudCaughtUsdMinor += txn.usdMinor;
				} else {
					missedFraud++;
				}
			} else if (txn.flagged) {
				falsePositives++;
			}
		}
	}

	return {
		fromBucket,
		toBucket,
		txnCount,
		volumeUsdMinor,
		flaggedCount,
		fraudCount,
		fraudCaught,
		fraudCaughtUsdMinor,
		falsePositives,
		missedFraud,
	};
}
