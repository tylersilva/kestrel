/**
 * Cross-runtime determinism fixtures. These hashes lock the simulated world:
 * the SAME values must reproduce in the node pool AND the workerd pool (and,
 * by extension, every browser). If an intentional engine change breaks them,
 * bump ENGINE_VERSION and regenerate via:
 *
 *   node test/helpers/regen.ts
 */

export function fnv1a(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}

export const REFERENCE = {
	/** Ordinary baseline-only bucket. */
	bucket12345: "5132d7cd",
	/** A 2026-era bucket (follow-the-sun at a different world clock). */
	bucket357056640: "b95c6b9f",
	/** Bucket with active fraud episodes. */
	bucket51: "9e10236f",
	/** Episode schedule for a far-future act. */
	episodesAct2975472: "ddac056f",
	/** Full KPI aggregation over act 0 (buckets 0..119). */
	kpiAct0: "ba101936",
} as const;
