import { beforeEach, describe, expect, it } from "vitest";
import {
	type ConditionalResult,
	cached,
	clearCache,
} from "../../worker/lib/cache.ts";

function clockAt(ms: number) {
	return () => ms;
}

describe("memory cache", () => {
	beforeEach(() => clearCache());

	it("serves fresh entries without refetching", async () => {
		let calls = 0;
		const fetcher = async (): Promise<ConditionalResult<string>> => {
			calls++;
			return { status: 200, etag: "e1", body: "v1" };
		};
		const first = await cached("k", 1000, fetcher, clockAt(0));
		const second = await cached("k", 1000, fetcher, clockAt(500));
		expect(first?.body).toBe("v1");
		expect(second?.body).toBe("v1");
		expect(second?.stale).toBe(false);
		expect(calls).toBe(1);
	});

	it("revalidates with the stored etag after TTL and honors 304", async () => {
		const seenEtags: (string | null)[] = [];
		let response: ConditionalResult<string> = {
			status: 200,
			etag: "e1",
			body: "v1",
		};
		const fetcher = async (etag: string | null) => {
			seenEtags.push(etag);
			return response;
		};
		await cached("k", 1000, fetcher, clockAt(0));
		response = { status: 304 };
		const after = await cached("k", 1000, fetcher, clockAt(2000));
		expect(seenEtags).toEqual([null, "e1"]);
		expect(after?.body).toBe("v1");
		expect(after?.stale).toBe(false);
		// The 304 bumped freshness — no further fetch inside the new TTL.
		const again = await cached("k", 1000, fetcher, clockAt(2500));
		expect(seenEtags).toHaveLength(2);
		expect(again?.body).toBe("v1");
	});

	it("serves stale on refresh failure and marks it", async () => {
		let fail = false;
		const fetcher = async (): Promise<ConditionalResult<string>> => {
			if (fail) {
				throw new Error("network down");
			}
			return { status: 200, etag: null, body: "v1" };
		};
		await cached("k", 1000, fetcher, clockAt(0));
		fail = true;
		const stale = await cached("k", 1000, fetcher, clockAt(5000));
		expect(stale?.body).toBe("v1");
		expect(stale?.stale).toBe(true);
	});

	it("treats non-200 upstream status as failure (stale if possible)", async () => {
		let status = 200;
		const fetcher = async (): Promise<ConditionalResult<string>> => {
			return status === 200 ? { status, etag: null, body: "v1" } : { status };
		};
		await cached("k", 1000, fetcher, clockAt(0));
		status = 403; // rate limited
		const outcome = await cached("k", 1000, fetcher, clockAt(5000));
		expect(outcome?.body).toBe("v1");
		expect(outcome?.stale).toBe(true);
	});

	it("returns null when there has never been a successful fetch", async () => {
		const fetcher = async (): Promise<ConditionalResult<string>> => {
			throw new Error("down");
		};
		expect(await cached("k", 1000, fetcher, clockAt(0))).toBeNull();
	});

	it("dedupes concurrent misses into one upstream fetch", async () => {
		let calls = 0;
		let release: (v: ConditionalResult<string>) => void = () => {};
		const gate = new Promise<ConditionalResult<string>>((resolve) => {
			release = resolve;
		});
		const fetcher = async () => {
			calls++;
			return gate;
		};
		const p1 = cached("k", 1000, fetcher, clockAt(0));
		const p2 = cached("k", 1000, fetcher, clockAt(0));
		release({ status: 200, etag: null, body: "v1" });
		const [a, b] = await Promise.all([p1, p2]);
		expect(calls).toBe(1);
		expect(a?.body).toBe("v1");
		expect(b?.body).toBe("v1");
	});

	it("backs off after a failure instead of hammering the upstream", async () => {
		let calls = 0;
		const failing = async (): Promise<ConditionalResult<string>> => {
			calls++;
			throw new Error("down");
		};
		expect(await cached("k", 1000, failing, clockAt(0))).toBeNull();
		// Within the 30s backoff window: no new upstream attempt.
		expect(await cached("k", 1000, failing, clockAt(1_000))).toBeNull();
		expect(calls).toBe(1);
		// Past the window: one more attempt is allowed.
		await cached("k", 1000, failing, clockAt(40_000));
		expect(calls).toBe(2);
	});
});
