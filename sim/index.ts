/**
 * Kestrel simulation engine — public contract.
 *
 * Purity rules for everything under sim/:
 * - Zero dependencies. No DOM, no Workers APIs, no Node APIs.
 * - Never read the clock (no Date.now()) — callers pass time in.
 * - All generation is a pure function of (GLOBAL_SEED, bucketIndex), so the
 *   browser and the Worker compute the identical world.
 *
 * Bump ENGINE_VERSION on ANY change that affects generated output — clients
 * and the Worker must agree on the stream, and snapshot tests lock it.
 */

export const GLOBAL_SEED = 0xfa1c0;
export const BUCKET_MS = 5000;
export const ENGINE_VERSION = "0.1.0";

/** The world-time bucket a given unix-ms timestamp falls in. */
export function bucketIndexFor(unixMs: number): number {
	return Math.floor(unixMs / BUCKET_MS);
}
