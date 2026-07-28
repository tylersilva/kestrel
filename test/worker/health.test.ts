import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../../sim/index.ts";
import app from "../../worker/index.ts";

describe("worker api", () => {
	it("serves /api/health", async () => {
		const res = await app.request("/api/health");
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; engineVersion: string };
		expect(body.ok).toBe(true);
		expect(body.engineVersion).toBe(ENGINE_VERSION);
	});

	it("serves the shared-seed sim config", async () => {
		const res = await app.request("/api/sim/config");
		expect(res.status).toBe(200);
		const body = (await res.json()) as { seed: number; bucketMs: number };
		expect(body.seed).toBeTypeOf("number");
		expect(body.bucketMs).toBe(5000);
	});

	it("returns a JSON error envelope for unknown api routes", async () => {
		const res = await app.request("/api/nope");
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("not_found");
	});
});
