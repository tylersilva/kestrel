import { CITIES } from "../cities.ts";
import { rangeInt } from "../prng.ts";
import type { EpisodeSpec, TxnDraft } from "../types.ts";
import { episodeRng, fraudTxn } from "./util.ts";

/**
 * Mule-network fan-out: one large placement lands at a hub, then money
 * radiates out in P2P transfers to many cities over ~2 minutes. The globe
 * showpiece — a red radial burst.
 */

export const DURATION = 25;

export function emit(spec: EpisodeSpec, bucketIndex: number): TxnDraft[] {
	const rel = bucketIndex - spec.startBucket;
	const rng = episodeRng(spec.seed, rel);

	if (rel === 0) {
		// Placement: big inbound wire. Looks almost clean — under the
		// threshold by design; the fan-out is what gets caught.
		return [
			fraudTxn({
				rng,
				bucketIndex,
				fromCity: spec.targetCity,
				toCity: spec.originCity,
				usdMinor: 5_000_000 + Math.floor(rng() * 20_000_001), // $50k–$250k
				channel: "wire",
				risk: 0.68 + rng() * 0.1,
				pattern: "mule_fanout",
				detectable: false,
			}),
		];
	}

	const txns: TxnDraft[] = [];
	for (let i = 0; i < spec.intensity; i++) {
		// Spray destinations — any city except the hub.
		let dest = CITIES[rangeInt(rng, 0, CITIES.length - 1)];
		if (dest.id === spec.originCity) {
			dest = CITIES[(CITIES.indexOf(dest) + 1) % CITIES.length];
		}
		txns.push(
			fraudTxn({
				rng,
				bucketIndex,
				fromCity: spec.originCity,
				toCity: dest.id,
				usdMinor: 50_000 + Math.floor(rng() * 350_001), // $500–$4,000
				channel: "p2p",
				risk: 0.76 + (rel / (DURATION - 1)) * 0.18 + rng() * 0.05,
				pattern: "mule_fanout",
			}),
		);
	}
	return txns;
}
