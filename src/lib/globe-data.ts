import { cityById, type Transaction } from "../../sim/index.ts";
import { riskTone } from "./format.ts";

/**
 * Pure mapping from the transaction stream to globe primitives. Everything
 * here is testable without WebGL — the Globe component is a thin binding.
 */

export interface GlobeArc {
	readonly id: string;
	readonly startLat: number;
	readonly startLng: number;
	readonly endLat: number;
	readonly endLng: number;
	readonly color: string;
	readonly stroke: number;
	readonly risk: number;
	/** Wall-clock ms when the arc was added (display TTL, not sim time). */
	readonly bornAt: number;
}

export interface GlobeRing {
	readonly id: string;
	readonly lat: number;
	readonly lng: number;
	readonly maxRadius: number;
	readonly speed: number;
	readonly bornAt: number;
}

export const ARC_TTL_MS = 4_000;
export const RING_TTL_MS = 2_500;

export const QUALITY = {
	high: { arcCap: 120, ringCap: 20, hexResolution: 3 },
	low: { arcCap: 60, ringCap: 10, hexResolution: 2 },
} as const;

export type QualityLevel = keyof typeof QUALITY;

const ARC_COLOR: Record<ReturnType<typeof riskTone>, string> = {
	signal: "rgba(45, 224, 194, 0.5)",
	warn: "rgba(242, 177, 61, 0.7)",
	alert: "rgba(255, 77, 94, 0.95)",
};

/** Stroke widens with USD magnitude — banded, not continuous. */
function strokeFor(usdMinor: number): number {
	if (usdMinor >= 100_000_000) {
		return 1.6; // ≥ $1M
	}
	if (usdMinor >= 10_000_000) {
		return 1.15; // ≥ $100k
	}
	if (usdMinor >= 1_000_000) {
		return 0.8; // ≥ $10k
	}
	if (usdMinor >= 100_000) {
		return 0.55; // ≥ $1k
	}
	return 0.35;
}

export function txnToArc(txn: Transaction, bornAt: number): GlobeArc {
	const from = cityById(txn.fromCity);
	const to = cityById(txn.toCity);
	return {
		id: txn.id,
		startLat: from.lat,
		startLng: from.lng,
		endLat: to.lat,
		endLng: to.lng,
		color: ARC_COLOR[riskTone(txn.riskScore)],
		stroke: strokeFor(txn.usdMinor),
		risk: txn.riskScore,
		bornAt,
	};
}

/** Flagged transactions pulse at their destination; clean ones don't. */
export function txnToRing(txn: Transaction, bornAt: number): GlobeRing | null {
	if (!txn.flagged) {
		return null;
	}
	const to = cityById(txn.toCity);
	return {
		id: `ring-${txn.id}`,
		lat: to.lat,
		lng: to.lng,
		maxRadius: 3 + txn.riskScore * 4,
		speed: 4,
		bornAt,
	};
}

export function pruneByTtl<T extends { bornAt: number }>(
	items: readonly T[],
	now: number,
	ttlMs: number,
): T[] {
	return items.filter((item) => now - item.bornAt < ttlMs);
}

/** Over the cap, the lowest-risk arcs go first — alerts always survive. */
export function capArcs(arcs: readonly GlobeArc[], cap: number): GlobeArc[] {
	if (arcs.length <= cap) {
		return [...arcs];
	}
	return [...arcs].sort((a, b) => b.risk - a.risk).slice(0, cap);
}
