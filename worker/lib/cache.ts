/**
 * Module-scope memory cache with conditional refetch and serve-stale-on-error.
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

const store = new Map<string, CacheEntry>();

/**
 * Fresh entry → return it. Expired → conditional refetch (If-None-Match).
 * 304 → bump freshness. Any failure → serve stale if we have anything,
 * null only when there has never been a successful fetch.
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
	try {
		const result = await fetcher(entry?.etag ?? null);
		if (result.status === 304 && entry) {
			entry.fetchedAt = ts;
			return { body: entry.body as T, stale: false, fetchedAt: ts };
		}
		if (result.status === 200 && result.body !== undefined) {
			store.set(key, {
				etag: result.etag ?? null,
				body: result.body,
				fetchedAt: ts,
			});
			return { body: result.body, stale: false, fetchedAt: ts };
		}
		throw new Error(`upstream status ${result.status}`);
	} catch {
		if (entry) {
			return { body: entry.body as T, stale: true, fetchedAt: entry.fetchedAt };
		}
		return null;
	}
}

/** Test hook. */
export function clearCache(): void {
	store.clear();
}
