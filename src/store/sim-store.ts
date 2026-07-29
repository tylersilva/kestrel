import { create } from "zustand";
import {
	ACT_BUCKETS,
	episodesForAct,
	episodeTransactions,
	GLOBAL_SEED,
	type KpiSnapshot,
	type Transaction,
} from "../../sim/index.ts";

/**
 * Client world state. Ring buffers are capped so an always-on dashboard
 * never grows; components subscribe via selectors to avoid re-render storms.
 */

const FEED_CAP = 48;
// Sized so `recent` genuinely spans ~2 minutes of traffic (~20 txns per 5s
// bucket) — the globe's hover tooltip counts a real time window over it.
const RECENT_CAP = 500;
const RISK_CAP = 120; // trailing 10 minutes

export interface KpiTotals {
	txnCount: number;
	volumeUsdMinor: number;
	flaggedCount: number;
	fraudCount: number;
	fraudCaught: number;
	fraudCaughtUsdMinor: number;
	falsePositives: number;
	missedFraud: number;
	episodesTotal: number;
	episodesDetected: number;
}

export interface RiskPoint {
	bucketIndex: number;
	avgRisk: number;
	maxRisk: number;
	txnCount: number;
	flaggedCount: number;
}

export type SimPhase = "connecting" | "syncing" | "live" | "error";

const EMPTY_KPIS: KpiTotals = {
	txnCount: 0,
	volumeUsdMinor: 0,
	flaggedCount: 0,
	fraudCount: 0,
	fraudCaught: 0,
	fraudCaughtUsdMinor: 0,
	falsePositives: 0,
	missedFraud: 0,
	episodesTotal: 0,
	episodesDetected: 0,
};

function riskPointFor(bucketIndex: number, txns: Transaction[]): RiskPoint {
	let sum = 0;
	let max = 0;
	let flagged = 0;
	for (const t of txns) {
		sum += t.riskScore;
		if (t.riskScore > max) {
			max = t.riskScore;
		}
		if (t.flagged) {
			flagged++;
		}
	}
	return {
		bucketIndex,
		avgRisk: txns.length > 0 ? sum / txns.length : 0,
		maxRisk: max,
		txnCount: txns.length,
		flaggedCount: flagged,
	};
}

interface SimStore {
	phase: SimPhase;
	syncProgress: number;
	kpi: KpiTotals;
	/** Flagged transactions, newest first. */
	feed: Transaction[];
	/** All recent transactions (the corridor board), newest first. */
	recent: Transaction[];
	/** Per-bucket risk, oldest first. */
	risk: RiskPoint[];

	setPhase(phase: SimPhase): void;
	setSyncProgress(progress: number): void;
	seedKpis(snapshot: KpiSnapshot): void;
	/** UTC midnight rollover: "today" starts over for every viewer at once. */
	resetDay(): void;
	/**
	 * Account a completed generation of bucket `bucketIndex`: KPI totals and
	 * the risk series. Mirrors aggregateRange's accounting exactly, so any
	 * client's numbers can be spot-checked against /api/sim/kpis.
	 */
	applyBucket(bucketIndex: number, txns: Transaction[]): void;
	/** Push one transaction into the display rings (feed/corridors). */
	emitTxn(txn: Transaction): void;
	/** Backfill display rings without touching KPI totals. */
	backfillDisplay(
		buckets: { bucketIndex: number; txns: Transaction[] }[],
	): void;
}

export const useSimStore = create<SimStore>((set) => ({
	phase: "connecting",
	syncProgress: 0,
	kpi: EMPTY_KPIS,
	feed: [],
	recent: [],
	risk: [],

	setPhase: (phase) => set({ phase }),
	setSyncProgress: (syncProgress) => set({ syncProgress }),
	resetDay: () => set({ kpi: EMPTY_KPIS }),

	seedKpis: (snapshot) =>
		set({
			kpi: {
				txnCount: snapshot.txnCount,
				volumeUsdMinor: snapshot.volumeUsdMinor,
				flaggedCount: snapshot.flaggedCount,
				fraudCount: snapshot.fraudCount,
				fraudCaught: snapshot.fraudCaught,
				fraudCaughtUsdMinor: snapshot.fraudCaughtUsdMinor,
				falsePositives: snapshot.falsePositives,
				missedFraud: snapshot.missedFraud,
				episodesTotal: snapshot.episodesTotal,
				episodesDetected: snapshot.episodesDetected,
			},
		}),

	applyBucket: (bucketIndex, txns) =>
		set((state) => {
			const kpi = { ...state.kpi };
			for (const t of txns) {
				kpi.txnCount++;
				kpi.volumeUsdMinor += t.usdMinor;
				if (t.flagged) {
					kpi.flaggedCount++;
				}
				if (t.fraudPattern !== null) {
					kpi.fraudCount++;
					if (t.flagged) {
						kpi.fraudCaught++;
						kpi.fraudCaughtUsdMinor += t.usdMinor;
					} else {
						kpi.missedFraud++;
					}
				} else if (t.flagged) {
					kpi.falsePositives++;
				}
			}
			// Episodes join the moment their start bucket passes — the same
			// rule aggregateRange applies.
			for (const ep of episodesForAct(
				GLOBAL_SEED,
				Math.floor(bucketIndex / ACT_BUCKETS),
			)) {
				if (ep.startBucket === bucketIndex) {
					kpi.episodesTotal++;
					if (episodeTransactions(ep).some((t) => t.flagged)) {
						kpi.episodesDetected++;
					}
				}
			}
			const risk = [...state.risk, riskPointFor(bucketIndex, txns)];
			if (risk.length > RISK_CAP) {
				risk.splice(0, risk.length - RISK_CAP);
			}
			return { kpi, risk };
		}),

	emitTxn: (txn) =>
		set((state) => {
			const recent = [txn, ...state.recent].slice(0, RECENT_CAP);
			const feed = txn.flagged
				? [txn, ...state.feed].slice(0, FEED_CAP)
				: state.feed;
			return { recent, feed };
		}),

	backfillDisplay: (buckets) =>
		set(() => {
			// Reset, don't append — a re-boot must not duplicate risk points.
			const all = buckets.flatMap((b) => b.txns);
			const flagged = all.filter((t) => t.flagged);
			return {
				recent: all.slice(-RECENT_CAP).reverse(),
				feed: flagged.slice(-FEED_CAP).reverse(),
				risk: buckets
					.map((b) => riskPointFor(b.bucketIndex, b.txns))
					.slice(-RISK_CAP),
			};
		}),
}));
