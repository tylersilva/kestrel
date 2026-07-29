/**
 * Kestrel simulation engine — public API.
 *
 * Purity rules for everything under sim/:
 * - Zero dependencies. No DOM, no Workers APIs, no Node APIs.
 * - Never read the clock (no Date.now()) — callers pass time in.
 * - No transcendental math (log/exp/sin/cos/pow) — engines differ in the
 *   last ulp and the world must be bit-identical everywhere.
 * - All generation is a pure function of (GLOBAL_SEED, bucketIndex), so the
 *   browser and the Worker compute the identical world.
 *
 * Bump ENGINE_VERSION on ANY change that affects generated output — clients
 * and the Worker must agree on the stream, and snapshot tests lock it.
 */

export { CITIES, type City, cityById, type Region } from "./cities.ts";
export {
	ACT_BUCKETS,
	BUCKET_MS,
	bucketIndexFor,
	ENGINE_VERSION,
	GLOBAL_SEED,
	minuteOfDayUtc,
} from "./constants.ts";
export { generateBucket, patternDuration, simulateRange } from "./engine.ts";
export { episodesForAct } from "./episodes.ts";
export { FX, localize } from "./fx.ts";
export { aggregateRange } from "./kpi.ts";
export {
	type Channel,
	type EpisodeSpec,
	FLAG_THRESHOLD,
	type FraudPatternId,
	type KpiSnapshot,
	type Transaction,
	type TxnDraft,
} from "./types.ts";
export { bucketTxnTarget, cityActivity, worldActivity } from "./volume.ts";
