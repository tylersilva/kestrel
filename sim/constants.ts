/**
 * Engine constants. Everything downstream derives from these.
 *
 * Bump ENGINE_VERSION on ANY change that affects generated output — the
 * browser and the Worker must compute identical worlds, and snapshot tests
 * lock the stream.
 */

export const GLOBAL_SEED = 0xfa1c0;
export const BUCKET_MS = 5000;
export const ENGINE_VERSION = "0.2.0";

/** Buckets per 10-minute "act" — the fraud-episode scheduling window. */
export const ACT_BUCKETS = 120;

/** The world-time bucket a given unix-ms timestamp falls in. */
export function bucketIndexFor(unixMs: number): number {
	return Math.floor(unixMs / BUCKET_MS);
}

/** Minute-of-day (UTC, 0..1439) at the START of a bucket. */
export function minuteOfDayUtc(bucketIndex: number): number {
	return Math.floor((bucketIndex * BUCKET_MS) / 60_000) % 1440;
}
