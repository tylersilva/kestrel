/**
 * Regenerates the cross-runtime REFERENCE hashes after an INTENTIONAL engine
 * change (which also requires an ENGINE_VERSION bump):
 *
 *   node test/helpers/regen.ts
 *
 * Paste the printed values into REFERENCE in test/helpers/reference.ts, then
 * run `pnpm test -- -u` to refresh vitest snapshots.
 */
import { GLOBAL_SEED } from "../../sim/constants.ts";
import { generateBucket } from "../../sim/engine.ts";
import { episodesForAct } from "../../sim/episodes.ts";
import { aggregateRange } from "../../sim/kpi.ts";
import { fnv1a } from "./reference.ts";

const regenerated = {
	bucket12345: fnv1a(JSON.stringify(generateBucket(GLOBAL_SEED, 12345))),
	bucket357056640: fnv1a(
		JSON.stringify(generateBucket(GLOBAL_SEED, 357056640)),
	),
	bucket51: fnv1a(JSON.stringify(generateBucket(GLOBAL_SEED, 51))),
	episodesAct2975472: fnv1a(
		JSON.stringify(episodesForAct(GLOBAL_SEED, 2975472)),
	),
	kpiAct0: fnv1a(JSON.stringify(aggregateRange(GLOBAL_SEED, 0, 119))),
};

console.log(JSON.stringify(regenerated, null, "\t"));
