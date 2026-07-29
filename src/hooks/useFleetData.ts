import { useEffect, useState } from "react";
import type {
	FleetEvent,
	FleetPrCard,
	FleetSummary,
} from "../../worker/lib/fleet-shape.ts";

export interface FleetMeta {
	stale: boolean;
	fetchedAt: number;
	authenticated: boolean;
}

export interface FleetData {
	summary: FleetSummary | null;
	prs: FleetPrCard[];
	events: FleetEvent[];
	meta: FleetMeta | null;
	failed: boolean;
	loading: boolean;
}

const REFRESH_MS = 5 * 60_000;

const INITIAL: FleetData = {
	summary: null,
	prs: [],
	events: [],
	meta: null,
	failed: false,
	loading: true,
};

/** Fetches both fleet endpoints, refreshing every five minutes. */
export function useFleetData(): FleetData {
	const [data, setData] = useState<FleetData>(INITIAL);

	useEffect(() => {
		let disposed = false;

		const load = async () => {
			try {
				const [summaryRes, activityRes] = await Promise.all([
					fetch("/api/fleet/summary"),
					fetch("/api/fleet/activity"),
				]);
				if (!summaryRes.ok || !activityRes.ok) {
					throw new Error("fleet upstream unavailable");
				}
				const summaryBody = (await summaryRes.json()) as {
					summary: FleetSummary;
					prs: FleetPrCard[];
					meta: FleetMeta;
				};
				const activityBody = (await activityRes.json()) as {
					events: FleetEvent[];
					meta: FleetMeta;
				};
				if (disposed) {
					return;
				}
				setData({
					summary: summaryBody.summary,
					prs: summaryBody.prs,
					events: activityBody.events,
					meta: {
						...summaryBody.meta,
						stale: summaryBody.meta.stale || activityBody.meta.stale,
					},
					failed: false,
					loading: false,
				});
			} catch {
				if (!disposed) {
					setData((prev) => ({ ...prev, failed: true, loading: false }));
				}
			}
		};

		load();
		const interval = setInterval(load, REFRESH_MS);
		return () => {
			disposed = true;
			clearInterval(interval);
		};
	}, []);

	return data;
}
