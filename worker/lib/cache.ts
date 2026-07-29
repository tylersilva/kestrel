/**
 * Module-scope memory cache with conditional refetch, in-flight dedup,
 * failure backoff, and serve-stale-on-error.
 *
 * This is deliberately NOT the Cache API — which is a silent no-op on
 * workers.dev subdomains. Isolates live long enough in practice that a
 * per-isolate Map with ETag revalidation (304s are free against GitHub's
 * rate limit) does the job for v1.
 */

export interface ConditionalResult<T> {
	status: number;
	etag?: string | null;
	body?: T;
}

export type ConditionalFetcher<T> = (
	etag: string | null,
) => Promise<ConditionalResult<T>>;

export interface CachedOutcome<T> {
	body: T;
	/** true when this is old data served because the refresh failed. */
	stale: boolean;
	fetchedAt: number;
}

interface CacheEntry {
	etag: string | null;
	body: unknown;
	fetchedAt: number;
}

/** After a failed refresh, don't hit the upstream again for this long —
 * bounds traffic amplification through a public endpoint to 1 upstream
 * call per key per window, no matter the request rate. */
const FAILURE_BACKOFF_MS = 30_000;

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CachedOutcome<unknown> | null>>();
const lastFailureAt = new Map<string, number>();

/**
 * Fresh entry → return it. Expired → conditional refetch (If-None-Match),
 * deduped so concurrent callers share one upstream request. 304 → bump
 * freshness. Any failure → serve stale if we have anything (null only when
 * there has never been a successful fetch) and back off further refetches.
 */
export async function cached<T>(
	key: string,
	ttlMs: number,
	fetcher: ConditionalFetcher<T>,
	now: () => number = Date.now,
): Promise<CachedOutcome<T> | null> {
	const entry = store.get(key);
	const ts = now();
	if (entry && ts - entry.fetchedAt < ttlMs) {
		return { body: entry.body as T, stale: false, fetchedAt: entry.fetchedAt };
	}

	const failedAt = lastFailureAt.get(key);
	if (failedAt !== undefined && ts - failedAt < FAILURE_BACKOFF_MS) {
		return entry
			? { body: entry.body as T, stale: true, fetchedAt: entry.fetchedAt }
			: null;
	}

	const running = inflight.get(key);
	if (running) {
		return running as Promise<CachedOutcome<T> | null>;
	}

	const refresh = (async (): Promise<CachedOutcome<T> | null> => {
		try {
			const result = await fetcher(entry?.etag ?? null);
			if (result.status === 304 && entry) {
				// NOTE: if another caller replaced the entry meanwhile, this
				// mutates an orphaned object — harmless: the Map holds the
				// newer entry and this response still serves valid data.
				entry.fetchedAt = ts;
				lastFailureAt.delete(key);
				return { body: entry.body as T, stale: false, fetchedAt: ts };
			}
			if (result.status === 200 && result.body !== undefined) {
				store.set(key, {
					etag: result.etag ?? null,
					body: result.body,
					fetchedAt: ts,
				});
				lastFailureAt.delete(key);
				return { body: result.body, stale: false, fetchedAt: ts };
			}
			throw new Error(`upstream status ${result.status}`);
		} catch {
			lastFailureAt.set(key, now());
			if (entry) {
				return {
					body: entry.body as T,
					stale: true,
					fetchedAt: entry.fetchedAt,
				};
			}
			return null;
		} finally {
			inflight.delete(key);
		}
	})();

	inflight.set(key, refresh as Promise<CachedOutcome<unknown> | null>);
	return refresh;
}

/** Test hook. */
export function clearCache(): void {
	store.clear();
	inflight.clear();
	lastFailureAt.clear();
}
