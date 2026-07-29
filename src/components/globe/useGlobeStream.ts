import { useEffect, useState } from "react";
import {
	ARC_TTL_MS,
	capArcs,
	type GlobeArc,
	type GlobeRing,
	pruneByTtl,
	QUALITY,
	type QualityLevel,
	RING_TTL_MS,
	txnToArc,
	txnToRing,
} from "../../lib/globe-data.ts";
import { useSimStore } from "../../store/sim-store.ts";

const SWEEP_MS = 500;
const SEEN_CAP = 1_000;

/**
 * Adapts the store's transaction rings into TTL-pruned arc/ring lists.
 * New transactions become arcs (and rings when flagged) the moment they
 * emit; a periodic sweep retires the expired ones.
 */
export function useGlobeStream(quality: QualityLevel): {
	arcs: GlobeArc[];
	rings: GlobeRing[];
} {
	const [arcs, setArcs] = useState<GlobeArc[]>([]);
	const [rings, setRings] = useState<GlobeRing[]>([]);

	useEffect(() => {
		const preset = QUALITY[quality];
		const seen = new Set<string>();
		// Seed with what's already on screen so a mount doesn't burst-render
		// the whole backfill at once.
		for (const t of useSimStore.getState().recent) {
			seen.add(t.id);
		}

		const ingest = () => {
			const { recent } = useSimStore.getState();
			const fresh = recent.filter((t) => !seen.has(t.id));
			if (fresh.length === 0) {
				return;
			}
			const now = Date.now();
			for (const t of fresh) {
				seen.add(t.id);
			}
			if (seen.size > SEEN_CAP) {
				seen.clear();
				for (const t of recent) {
					seen.add(t.id);
				}
			}
			setArcs((prev) =>
				capArcs(
					pruneByTtl(
						[...prev, ...fresh.map((t) => txnToArc(t, now))],
						now,
						ARC_TTL_MS,
					),
					preset.arcCap,
				),
			);
			const freshRings = fresh
				.map((t) => txnToRing(t, now))
				.filter((r): r is GlobeRing => r !== null);
			if (freshRings.length > 0) {
				setRings((prev) =>
					pruneByTtl([...prev, ...freshRings], now, RING_TTL_MS).slice(
						-preset.ringCap,
					),
				);
			}
		};

		const unsubscribe = useSimStore.subscribe(ingest);
		const sweep = setInterval(() => {
			const now = Date.now();
			setArcs((prev) =>
				prev.length > 0 ? pruneByTtl(prev, now, ARC_TTL_MS) : prev,
			);
			setRings((prev) =>
				prev.length > 0 ? pruneByTtl(prev, now, RING_TTL_MS) : prev,
			);
		}, SWEEP_MS);

		return () => {
			unsubscribe();
			clearInterval(sweep);
		};
	}, [quality]);

	return { arcs, rings };
}
