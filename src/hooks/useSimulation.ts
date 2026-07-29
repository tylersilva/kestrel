import { useEffect } from "react";
import {
	aggregateRange,
	BUCKET_MS,
	bucketIndexFor,
	GLOBAL_SEED,
	generateBucket,
	type KpiSnapshot,
} from "../../sim/index.ts";
import { useSimStore } from "../store/sim-store.ts";
import type { SimClock } from "./useSimClock.ts";

const BUCKETS_PER_DAY = 86_400_000 / BUCKET_MS;
const REPLAY_CHUNK = 1_500; // buckets per slice (~50ms of work)
const BACKFILL_BUCKETS = 24; // trailing 2 minutes for the display rings

function sumKpis(a: KpiSnapshot, b: KpiSnapshot): KpiSnapshot {
	return {
		fromBucket: Math.min(a.fromBucket, b.fromBucket),
		toBucket: Math.max(a.toBucket, b.toBucket),
		txnCount: a.txnCount + b.txnCount,
		volumeUsdMinor: a.volumeUsdMinor + b.volumeUsdMinor,
		flaggedCount: a.flaggedCount + b.flaggedCount,
		fraudCount: a.fraudCount + b.fraudCount,
		fraudCaught: a.fraudCaught + b.fraudCaught,
		fraudCaughtUsdMinor: a.fraudCaughtUsdMinor + b.fraudCaughtUsdMinor,
		falsePositives: a.falsePositives + b.falsePositives,
		missedFraud: a.missedFraud + b.missedFraud,
		episodesTotal: a.episodesTotal + b.episodesTotal,
		episodesDetected: a.episodesDetected + b.episodesDetected,
	};
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * The simulation host. On mount (once the clock is synced):
 *   1. chunk-replays UTC-midnight → now to seed the day-to-date KPIs,
 *   2. backfills the trailing buckets into the display rings,
 *   3. ticks on every 5s bucket boundary, scheduling each transaction's
 *      feed emission at its intra-bucket timestamp so the stream flows
 *      continuously instead of clumping.
 *
 * Replay covers [dayStart, liveStart-1]; live accounting starts exactly at
 * liveStart — no bucket is counted twice and none is skipped.
 */
export function useSimulation(clock: SimClock): void {
	const ready = clock.config !== null;

	useEffect(() => {
		if (!ready) {
			return;
		}
		let disposed = false;
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const store = useSimStore.getState();

		const schedule = (fn: () => void, delayMs: number) => {
			const id = setTimeout(
				() => {
					timers.delete(id);
					fn();
				},
				Math.max(0, delayMs),
			);
			timers.add(id);
		};

		const emitBucket = (bucketIndex: number) => {
			const txns = generateBucket(GLOBAL_SEED, bucketIndex);
			useSimStore.getState().applyBucket(bucketIndex, txns);
			const now = clock.now();
			for (const txn of txns) {
				schedule(() => useSimStore.getState().emitTxn(txn), txn.ts - now);
			}
		};

		const startTicker = (nextBucket: number) => {
			const fire = (bucket: number) => {
				if (disposed) {
					return;
				}
				emitBucket(bucket);
				schedule(
					() => fire(bucket + 1),
					(bucket + 1) * BUCKET_MS - clock.now(),
				);
			};
			schedule(() => fire(nextBucket), nextBucket * BUCKET_MS - clock.now());
		};

		const boot = async () => {
			store.setPhase("syncing");
			const bootBucket = bucketIndexFor(clock.now());
			const dayStart =
				Math.floor(bootBucket / BUCKETS_PER_DAY) * BUCKETS_PER_DAY;

			// 1. Chunked day-to-date replay (KPIs only).
			let totals: KpiSnapshot | null = null;
			const replayEnd = bootBucket - 1;
			for (let from = dayStart; from <= replayEnd; from += REPLAY_CHUNK) {
				if (disposed) {
					return;
				}
				const to = Math.min(from + REPLAY_CHUNK - 1, replayEnd);
				const chunk = aggregateRange(GLOBAL_SEED, from, to);
				totals = totals ? sumKpis(totals, chunk) : chunk;
				useSimStore
					.getState()
					.setSyncProgress((to - dayStart + 1) / (replayEnd - dayStart + 1));
				await yieldToUi();
			}
			if (disposed) {
				return;
			}
			if (totals) {
				useSimStore.getState().seedKpis(totals);
			}

			// 2. Backfill display rings (no KPI double-count — replay owns
			//    everything before liveStart, display rings are cosmetic).
			const backfillFrom = Math.max(dayStart, bootBucket - BACKFILL_BUCKETS);
			const backfill = [];
			for (let b = backfillFrom; b < bootBucket; b++) {
				backfill.push({ bucketIndex: b, txns: generateBucket(GLOBAL_SEED, b) });
			}
			useSimStore.getState().backfillDisplay(backfill);

			// 3. Catch up any buckets that completed while we replayed, then tick.
			const liveStart = bucketIndexFor(clock.now());
			for (let b = bootBucket; b <= liveStart; b++) {
				if (disposed) {
					return;
				}
				emitBucket(b);
			}
			useSimStore.getState().setPhase("live");
			startTicker(liveStart + 1);
		};

		boot().catch(() => {
			if (!disposed) {
				useSimStore.getState().setPhase("error");
			}
		});

		return () => {
			disposed = true;
			for (const id of timers) {
				clearTimeout(id);
			}
			timers.clear();
		};
	}, [ready, clock]);
}
