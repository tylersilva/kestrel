import { CITIES, type City } from "./cities.ts";

/**
 * Follow-the-sun activity. Per-city activity is its weight scaled by a
 * local-hour curve; world volume is the sum. The curve is a lookup table with
 * linear interpolation — exact arithmetic only, no trig.
 */

/** Relative activity by local hour 0..23 (peaks late morning / early PM). */
const HOUR_ACTIVITY: readonly number[] = [
	0.1, 0.07, 0.05, 0.05, 0.07, 0.12, 0.25, 0.45, 0.7, 0.9, 1.0, 1.0, 0.95, 1.0,
	0.98, 0.92, 0.85, 0.7, 0.55, 0.42, 0.33, 0.26, 0.19, 0.13,
];

const TOTAL_WEIGHT = CITIES.reduce((sum, c) => sum + c.weight, 0);

/** Activity for one city at a UTC minute-of-day (0..1439). */
export function cityActivity(city: City, minuteUtc: number): number {
	const localMinute =
		(((minuteUtc + city.utcOffset * 60) % 1440) + 1440) % 1440;
	const hour = Math.floor(localMinute / 60) % 24;
	const nextHour = (hour + 1) % 24;
	const frac = (localMinute - hour * 60) / 60;
	const curve =
		HOUR_ACTIVITY[hour] +
		(HOUR_ACTIVITY[nextHour] - HOUR_ACTIVITY[hour]) * frac;
	return city.weight * curve;
}

/** World activity, normalized to 0..1 of the theoretical all-cities peak. */
export function worldActivity(minuteUtc: number): number {
	let total = 0;
	for (const city of CITIES) {
		total += cityActivity(city, minuteUtc);
	}
	return total / TOTAL_WEIGHT;
}

/**
 * Baseline transaction target for a bucket: 8..20 txns depending on where
 * the sun is. (Jitter is applied by the caller from its own rng stream.)
 */
export function bucketTxnTarget(minuteUtc: number): number {
	// worldActivity realistically swings ~0.3..0.65.
	return Math.round(4 + worldActivity(minuteUtc) * 26);
}
