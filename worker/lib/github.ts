import type { ConditionalFetcher, ConditionalResult } from "./cache.ts";

/**
 * Thin GitHub REST client. The client (browser) never talks to GitHub —
 * everything flows through the Worker so tokens stay server-side and
 * shaping happens in one place.
 */

const API = "https://api.github.com";
export const REPO = "tylersilva/kestrel";

export interface GhLabel {
	readonly name: string;
}

export interface GhUser {
	readonly login: string;
}

export interface GhPull {
	readonly number: number;
	readonly title: string;
	readonly state: "open" | "closed";
	readonly created_at: string;
	readonly merged_at: string | null;
	readonly labels: readonly GhLabel[];
	readonly user: GhUser | null;
	readonly html_url: string;
	readonly draft: boolean;
}

export interface GhIssue {
	readonly number: number;
	readonly title: string;
	readonly state: "open" | "closed";
	readonly created_at: string;
	readonly labels: readonly GhLabel[];
	readonly user: GhUser | null;
	readonly html_url: string;
	/** Present when the "issue" is actually a PR — the endpoint mixes them. */
	readonly pull_request?: object;
}

export interface GhCommit {
	readonly sha: string;
	readonly commit: {
		readonly message: string;
		readonly author: { readonly name: string; readonly date: string } | null;
	};
	readonly html_url: string;
}

export const GH_PATHS = {
	pulls: `/repos/${REPO}/pulls?state=all&per_page=100&sort=created&direction=desc`,
	issues: `/repos/${REPO}/issues?state=all&per_page=100&sort=created&direction=desc`,
	commits: `/repos/${REPO}/commits?per_page=100`,
} as const;

export function ghFetcher<T>(
	path: string,
	token: string | undefined,
): ConditionalFetcher<T> {
	return async (etag: string | null): Promise<ConditionalResult<T>> => {
		const headers: Record<string, string> = {
			accept: "application/vnd.github+json",
			"user-agent": "kestrel-fleet",
			"x-github-api-version": "2022-11-28",
		};
		if (token) {
			headers.authorization = `Bearer ${token}`;
		}
		if (etag) {
			headers["if-none-match"] = etag;
		}
		const res = await fetch(`${API}${path}`, { headers });
		if (res.status === 304) {
			return { status: 304 };
		}
		if (!res.ok) {
			return { status: res.status };
		}
		return {
			status: 200,
			etag: res.headers.get("etag"),
			body: (await res.json()) as T,
		};
	};
}
