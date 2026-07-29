import { Hono } from "hono";
import { cached } from "../lib/cache.ts";
import {
	shapeActivity,
	shapePrBoard,
	shapeSummary,
} from "../lib/fleet-shape.ts";
import {
	GH_PATHS,
	type GhCommit,
	type GhIssue,
	type GhPull,
	ghFetcher,
} from "../lib/github.ts";

const TTL_MS = 5 * 60_000;

interface GithubData {
	pulls: GhPull[];
	issues: GhIssue[];
	commits: GhCommit[];
	stale: boolean;
	fetchedAt: number;
	authenticated: boolean;
}

async function loadGithub(env: Env): Promise<GithubData | null> {
	const token = env.GITHUB_TOKEN;
	const [pulls, issues, commits] = await Promise.all([
		cached("gh:pulls", TTL_MS, ghFetcher<GhPull[]>(GH_PATHS.pulls, token)),
		cached("gh:issues", TTL_MS, ghFetcher<GhIssue[]>(GH_PATHS.issues, token)),
		cached(
			"gh:commits",
			TTL_MS,
			ghFetcher<GhCommit[]>(GH_PATHS.commits, token),
		),
	]);
	if (!pulls || !issues || !commits) {
		return null;
	}
	return {
		pulls: pulls.body,
		issues: issues.body,
		commits: commits.body,
		stale: pulls.stale || issues.stale || commits.stale,
		fetchedAt: Math.min(pulls.fetchedAt, issues.fetchedAt, commits.fetchedAt),
		authenticated: Boolean(token),
	};
}

const unavailable = {
	error: {
		code: "upstream_unavailable",
		message: "GitHub data is unavailable right now — try again shortly",
	},
} as const;

export const fleetRoutes = new Hono<{ Bindings: Env }>();

fleetRoutes.get("/summary", async (c) => {
	const data = await loadGithub(c.env);
	if (!data) {
		return c.json(unavailable, 503);
	}
	return c.json({
		summary: shapeSummary(data.pulls, data.issues, data.commits),
		prs: shapePrBoard(data.pulls),
		meta: {
			stale: data.stale,
			fetchedAt: data.fetchedAt,
			authenticated: data.authenticated,
		},
	});
});

fleetRoutes.get("/activity", async (c) => {
	const data = await loadGithub(c.env);
	if (!data) {
		return c.json(unavailable, 503);
	}
	return c.json({
		events: shapeActivity(data.pulls, data.issues, data.commits),
		meta: {
			stale: data.stale,
			fetchedAt: data.fetchedAt,
			authenticated: data.authenticated,
		},
	});
});
