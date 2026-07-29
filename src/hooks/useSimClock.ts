import { useCallback, useEffect, useRef, useState } from "react";

export interface SimConfig {
	seed: number;
	bucketMs: number;
	engineVersion: string;
	serverTime: number;
}

export interface SimClock {
	config: SimConfig | null;
	failed: boolean;
	/** Server-corrected wall clock — every viewer lands on the same bucket. */
	now(): number;
}

/**
 * Fetches /api/sim/config once and keeps a serverTime offset so a laptop
 * with a skewed clock still agrees with every other viewer about which
 * bucket "now" is.
 */
export function useSimClock(): SimClock {
	const [config, setConfig] = useState<SimConfig | null>(null);
	const [failed, setFailed] = useState(false);
	const offsetRef = useRef(0);

	useEffect(() => {
		let cancelled = false;
		const requested = Date.now();
		fetch("/api/sim/config")
			.then((r) => {
				if (!r.ok) {
					throw new Error(`config ${r.status}`);
				}
				return r.json() as Promise<SimConfig>;
			})
			.then((cfg) => {
				if (cancelled) {
					return;
				}
				// Midpoint correction for request latency.
				const latency = (Date.now() - requested) / 2;
				offsetRef.current = cfg.serverTime + latency - Date.now();
				setConfig(cfg);
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const now = useCallback(() => Date.now() + offsetRef.current, []);

	return { config, failed, now };
}
