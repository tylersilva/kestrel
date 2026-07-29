import { Hono } from "hono";
import {
	aggregateRange,
	BUCKET_MS,
	ENGINE_VERSION,
	GLOBAL_SEED,
	simulateRange,
} from "../../sim/index.ts";

/**
 * Sim API. The client generates the live stream locally from the shared
 * seed; these routes exist for clock sync and to prove the server computes
 * the same world. Span caps keep requests inside the Workers CPU budget.
 */

const MAX_BUCKETS_SPAN = 120; // 10 minutes of transactions
const MAX_KPIS_SPAN = 240; // 20 minutes of aggregation

type Range = { from: number; to: number };

function parseRange(
	fromRaw: string | undefined,
	toRaw: string | undefined,
	maxSpan: number,
): Range | string {
	const from = Number(fromRaw);
	const to = Number(toRaw);
	if (!Number.isInteger(from) || !Number.isInteger(to)) {
		return "from and to must be integer bucket indices";
	}
	if (from < 0 || to < from) {
		return "range must satisfy 0 <= from <= to";
	}
	if (to - from + 1 > maxSpan) {
		return `range must span at most ${maxSpan} buckets`;
	}
	return { from, to };
}

export const simRoutes = new Hono();

simRoutes.get("/config", (c) =>
	c.json({
		seed: GLOBAL_SEED,
		bucketMs: BUCKET_MS,
		engineVersion: ENGINE_VERSION,
		serverTime: Date.now(),
	}),
);

simRoutes.get("/buckets", (c) => {
	const range = parseRange(
		c.req.query("from"),
		c.req.query("to"),
		MAX_BUCKETS_SPAN,
	);
	if (typeof range === "string") {
		return c.json({ error: { code: "bad_request", message: range } }, 400);
	}
	return c.json({
		from: range.from,
		to: range.to,
		transactions: simulateRange(GLOBAL_SEED, range.from, range.to),
	});
});

simRoutes.get("/kpis", (c) => {
	const range = parseRange(
		c.req.query("from"),
		c.req.query("to"),
		MAX_KPIS_SPAN,
	);
	if (typeof range === "string") {
		return c.json({ error: { code: "bad_request", message: range } }, 400);
	}
	return c.json(aggregateRange(GLOBAL_SEED, range.from, range.to));
});
