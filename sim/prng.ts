/**
 * Deterministic PRNG core.
 *
 * Cross-engine determinism rules (V8, JavaScriptCore, SpiderMonkey must all
 * agree bit-for-bit):
 * - 32-bit integer mixing only (Math.imul, >>>, ^) for seeds and ids.
 * - IEEE-exact float ops only (+ - * / and comparisons) for everything else.
 * - NO transcendentals (Math.log/exp/sin/cos/pow) anywhere in sim/ — engines
 *   may differ in the last ulp, which would fork the simulated world.
 */

/** splitmix32 finalizer — decorrelates any 32-bit input. */
export function mix32(x: number): number {
	let t = (x >>> 0) + 0x9e3779b9;
	t = (t >>> 0) ^ (t >>> 16);
	t = Math.imul(t, 0x21f0aaad) >>> 0;
	t = t ^ (t >>> 15);
	t = Math.imul(t, 0x735a2d97) >>> 0;
	return (t ^ (t >>> 15)) >>> 0;
}

/** Combine two 32-bit values into a well-mixed 32-bit value. */
export function combine(a: number, b: number): number {
	return mix32((a >>> 0) ^ (Math.imul(b >>> 0, 0x9e3779b1) >>> 0));
}

/** A deterministic stream of floats in [0, 1). */
export type Rng = () => number;

/** mulberry32 — tiny, fast, bit-identical everywhere. */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
		t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Independent named sub-streams. Deriving each concern from its own tag means
 * adding draws to one stream never rewrites history in another.
 */
export const STREAM = {
	baseline: 0xba5e11,
	episodes: 0xe9150d,
	ids: 0x1d5eed,
} as const;

export function streamRng(globalSeed: number, index: number, tag: number): Rng {
	return mulberry32(combine(combine(globalSeed, tag), index));
}

/** Integer in [min, max] inclusive. */
export function rangeInt(rng: Rng, min: number, max: number): number {
	return min + Math.floor(rng() * (max - min + 1));
}

/** Weighted pick. Weights must be non-negative with a positive sum. */
export function pickWeighted<T>(
	rng: Rng,
	items: readonly T[],
	weightOf: (item: T, index: number) => number,
): T {
	const weights: number[] = new Array(items.length);
	let total = 0;
	for (let i = 0; i < items.length; i++) {
		weights[i] = weightOf(items[i], i);
		total += weights[i];
	}
	let target = rng() * total;
	for (let i = 0; i < items.length; i++) {
		target -= weights[i];
		if (target < 0) {
			return items[i];
		}
	}
	// Float edge: fall back to the last item.
	return items[items.length - 1];
}

/**
 * Heavy-tailed amount draw WITHOUT transcendentals: pick a magnitude band by
 * weight, then uniform within the band. Bands are [min, max] in integer
 * units; result is an integer.
 */
export interface Band {
	readonly min: number;
	readonly max: number;
	readonly weight: number;
}

export function bandedInt(rng: Rng, bands: readonly Band[]): number {
	const band = pickWeighted(rng, bands, (b) => b.weight);
	return rangeInt(rng, band.min, band.max);
}

/** Round to two decimals (exact: scale, round, unscale). */
export function round2(x: number): number {
	return Math.round(x * 100) / 100;
}
