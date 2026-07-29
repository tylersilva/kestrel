import { CITIES, type City } from "./cities.ts";
import { BUCKET_MS, minuteOfDayUtc } from "./constants.ts";
import { localize } from "./fx.ts";
import {
	type Band,
	bandedInt,
	pickWeighted,
	type Rng,
	round2,
	STREAM,
	streamRng,
} from "./prng.ts";
import type { TxnDraft } from "./types.ts";
import { type Channel, FLAG_THRESHOLD } from "./types.ts";
import { bucketTxnTarget, cityActivity } from "./volume.ts";

/**
 * Legitimate world traffic. Draw order per transaction is FIXED (origin,
 * destination, channel, amount band, amount, ts offset, risk noise, FP roll,
 * [FP boost]) — reordering draws rewrites history, so don't.
 */

const CHANNELS: readonly { channel: Channel; weight: number }[] = [
	{ channel: "card_not_present", weight: 30 },
	{ channel: "card_present", weight: 25 },
	{ channel: "p2p", weight: 20 },
	{ channel: "ach", weight: 15 },
	{ channel: "wire", weight: 10 },
];

/** Amount bands in integer USD cents, heavy-tailed per channel. */
const AMOUNT_BANDS: Readonly<Record<Channel, readonly Band[]>> = {
	card_present: [
		{ min: 100, max: 2_000, weight: 30 },
		{ min: 2_000, max: 15_000, weight: 50 },
		{ min: 15_000, max: 60_000, weight: 18 },
		{ min: 60_000, max: 250_000, weight: 2 },
	],
	card_not_present: [
		{ min: 200, max: 3_000, weight: 30 },
		{ min: 3_000, max: 20_000, weight: 45 },
		{ min: 20_000, max: 90_000, weight: 20 },
		{ min: 90_000, max: 400_000, weight: 5 },
	],
	p2p: [
		{ min: 100, max: 5_000, weight: 40 },
		{ min: 5_000, max: 30_000, weight: 45 },
		{ min: 30_000, max: 150_000, weight: 15 },
	],
	ach: [
		{ min: 5_000, max: 50_000, weight: 30 },
		{ min: 50_000, max: 500_000, weight: 45 },
		{ min: 500_000, max: 5_000_000, weight: 25 },
	],
	wire: [
		{ min: 100_000, max: 1_000_000, weight: 35 },
		{ min: 1_000_000, max: 10_000_000, weight: 45 },
		{ min: 10_000_000, max: 100_000_000, weight: 20 },
	],
};

const CHANNEL_RISK: Readonly<Record<Channel, number>> = {
	card_present: 0.06,
	card_not_present: 0.16,
	p2p: 0.13,
	ach: 0.1,
	wire: 0.18,
};

/** Squared "distance" in degree-space with longitude wrap — exact arithmetic. */
function dist2(a: City, b: City): number {
	const dLat = a.lat - b.lat;
	let dLng = a.lng - b.lng;
	if (dLng > 180) {
		dLng -= 360;
	} else if (dLng < -180) {
		dLng += 360;
	}
	return dLat * dLat + dLng * dLng * 0.64;
}

function destinationWeight(origin: City, candidate: City): number {
	if (candidate.id === origin.id) {
		return 0;
	}
	const regionBias = candidate.region === origin.region ? 3.5 : 1;
	return (
		(candidate.weight * regionBias) / (1 + dist2(origin, candidate) / 2000)
	);
}

function isLocalNight(city: City, minuteUtc: number): boolean {
	const localMinute =
		(((minuteUtc + city.utcOffset * 60) % 1440) + 1440) % 1440;
	return localMinute < 300; // 00:00–05:00 local
}

export function generateBaseline(
	seed: number,
	bucketIndex: number,
): TxnDraft[] {
	const rng: Rng = streamRng(seed, bucketIndex, STREAM.baseline);
	const minuteUtc = minuteOfDayUtc(bucketIndex);
	const bucketStart = bucketIndex * BUCKET_MS;

	// Target ±2 jitter, floor at 3 so the globe never looks dead.
	const jitter = Math.floor(rng() * 5) - 2;
	const count = Math.max(3, bucketTxnTarget(minuteUtc) + jitter);

	// Origin weights are identical for every txn in the bucket — hoist them.
	const originWeights = CITIES.map((c) => cityActivity(c, minuteUtc));

	const txns: TxnDraft[] = [];
	for (let i = 0; i < count; i++) {
		const origin = pickWeighted(rng, CITIES, (_, idx) => originWeights[idx]);
		const dest = pickWeighted(rng, CITIES, (c) => destinationWeight(origin, c));
		const channel = pickWeighted(rng, CHANNELS, (c) => c.weight).channel;
		const usdMinor = bandedInt(rng, AMOUNT_BANDS[channel]);
		const money = localize(usdMinor, origin.currency);
		const ts = bucketStart + Math.floor(rng() * BUCKET_MS);

		let risk = CHANNEL_RISK[channel];
		if (usdMinor > 50_000_000) {
			risk += 0.2; // > $500k
		} else if (usdMinor > 5_000_000) {
			risk += 0.12; // > $50k
		}
		if (isLocalNight(origin, minuteUtc)) {
			risk += 0.1;
		}
		if (dest.region !== origin.region) {
			risk += 0.08;
		}
		if (origin.weight <= 4 && dest.weight <= 4) {
			risk += 0.06; // rare corridor
		}
		risk += rng() * 0.25;
		// Legit traffic stays under the threshold…
		risk = Math.min(risk, 0.78);
		// …except a deterministic ~1.5% of false positives.
		if (rng() < 0.015) {
			risk = FLAG_THRESHOLD + rng() * 0.15;
		}
		risk = round2(risk);

		txns.push({
			ts,
			fromCity: origin.id,
			toCity: dest.id,
			amountMinor: money.amountMinor,
			currency: money.currency,
			usdMinor,
			channel,
			riskScore: risk,
			flagged: risk >= FLAG_THRESHOLD,
			fraudPattern: null,
		});
	}
	return txns;
}
