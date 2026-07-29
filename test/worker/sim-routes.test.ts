import { describe, expect, it } from "vitest";
import {
	aggregateRange,
	GLOBAL_SEED,
	type Transaction,
} from "../../sim/index.ts";
import app from "../../worker/index.ts";

describe("sim routes", () => {
	it("serves a bucket range", async () => {
		const res = await app.request("/api/sim/buckets?from=100&to=103");
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			from: number;
			to: number;
			transactions: Transaction[];
		};
		expect(body.from).toBe(100);
		expect(body.to).toBe(103);
		expect(body.transactions.length).toBeGreaterThan(0);
		expect(body.transactions[0]).toHaveProperty("riskScore");
	});

	it("caps the buckets span at 120", async () => {
		const res = await app.request("/api/sim/buckets?from=0&to=120");
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("bad_request");
	});

	it("rejects non-integer and inverted ranges", async () => {
		expect((await app.request("/api/sim/buckets?from=abc&to=5")).status).toBe(
			400,
		);
		expect((await app.request("/api/sim/buckets?from=9&to=5")).status).toBe(
			400,
		);
		expect((await app.request("/api/sim/buckets?from=-2&to=5")).status).toBe(
			400,
		);
		expect((await app.request("/api/sim/kpis?from=0&to=240")).status).toBe(400);
	});

	it("serves KPIs that match the engine exactly", async () => {
		const res = await app.request("/api/sim/kpis?from=0&to=119");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(aggregateRange(GLOBAL_SEED, 0, 119));
	});
});
