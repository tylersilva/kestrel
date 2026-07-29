import type { GhCommit, GhIssue, GhLabel, GhPull } from "./github.ts";

/**
 * Pure shaping from raw GitHub payloads to render-ready fleet data.
 * No fetch, no clock, no environment — fully unit-testable.
 */

export const AGENT_ROLES = [
	"planner",
	"builder",
	"reviewer",
	"tester",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export interface FleetSummary {
	readonly totalPrs: number;
	readonly mergedPrs: number;
	readonly mergeRatePct: number;
	readonly medianTimeToMergeMs: number | null;
	readonly commitCount: number;
	readonly openIssues: number;
	readonly agents: Record<AgentRole, number>;
	readonly activeAgents: number;
}

export interface FleetPrCard {
	readonly number: number;
	readonly title: string;
	readonly state: "open" | "merged" | "closed";
	readonly createdAt: number;
	readonly mergedAt: number | null;
	readonly agents: AgentRole[];
	readonly url: string;
}

export type FleetEventType =
	| "issue_opened"
	| "pr_opened"
	| "pr_merged"
	| "commit";

export interface FleetEvent {
	readonly type: FleetEventType;
	readonly ts: number;
	readonly title: string;
	readonly number?: number;
	readonly url: string;
	readonly agents: AgentRole[];
	readonly author: string;
}

const MAX_EVENTS = 200;

export function agentLabels(labels: readonly GhLabel[]): AgentRole[] {
	const roles: AgentRole[] = [];
	for (const label of labels) {
		const role = AGENT_ROLES.find((r) => label.name === `agent:${r}`);
		if (role && !roles.includes(role)) {
			roles.push(role);
		}
	}
	return roles;
}

/** The /issues endpoint interleaves PRs — keep only genuine issues. */
function realIssues(issues: readonly GhIssue[]): GhIssue[] {
	return issues.filter((i) => i.pull_request === undefined);
}

function median(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

export function shapeSummary(
	pulls: readonly GhPull[],
	issues: readonly GhIssue[],
	commits: readonly GhCommit[],
): FleetSummary {
	const merged = pulls.filter((p) => p.merged_at !== null);
	const timesToMerge = merged.map(
		(p) =>
			new Date(p.merged_at as string).getTime() -
			new Date(p.created_at).getTime(),
	);
	const agents: Record<AgentRole, number> = {
		planner: 0,
		builder: 0,
		reviewer: 0,
		tester: 0,
	};
	for (const item of [...pulls, ...realIssues(issues)]) {
		for (const role of agentLabels(item.labels)) {
			agents[role]++;
		}
	}
	return {
		totalPrs: pulls.length,
		mergedPrs: merged.length,
		mergeRatePct:
			pulls.length > 0 ? Math.round((merged.length / pulls.length) * 100) : 0,
		medianTimeToMergeMs: median(timesToMerge),
		commitCount: commits.length,
		openIssues: realIssues(issues).filter((i) => i.state === "open").length,
		agents,
		activeAgents: AGENT_ROLES.filter((r) => agents[r] > 0).length,
	};
}

export function shapePrBoard(
	pulls: readonly GhPull[],
	limit = 10,
): FleetPrCard[] {
	return pulls.slice(0, limit).map((p) => ({
		number: p.number,
		title: p.title,
		state: p.merged_at !== null ? "merged" : p.state,
		createdAt: new Date(p.created_at).getTime(),
		mergedAt: p.merged_at ? new Date(p.merged_at).getTime() : null,
		agents: agentLabels(p.labels),
		url: p.html_url,
	}));
}

export function shapeActivity(
	pulls: readonly GhPull[],
	issues: readonly GhIssue[],
	commits: readonly GhCommit[],
): FleetEvent[] {
	const events: FleetEvent[] = [];
	for (const issue of realIssues(issues)) {
		events.push({
			type: "issue_opened",
			ts: new Date(issue.created_at).getTime(),
			title: issue.title,
			number: issue.number,
			url: issue.html_url,
			agents: agentLabels(issue.labels),
			author: issue.user?.login ?? "unknown",
		});
	}
	for (const pull of pulls) {
		const agents = agentLabels(pull.labels);
		events.push({
			type: "pr_opened",
			ts: new Date(pull.created_at).getTime(),
			title: pull.title,
			number: pull.number,
			url: pull.html_url,
			agents,
			author: pull.user?.login ?? "unknown",
		});
		if (pull.merged_at !== null) {
			events.push({
				type: "pr_merged",
				ts: new Date(pull.merged_at).getTime(),
				title: pull.title,
				number: pull.number,
				url: pull.html_url,
				agents,
				author: pull.user?.login ?? "unknown",
			});
		}
	}
	for (const commit of commits) {
		// A missing git-author block means no usable timestamp — an epoch-0
		// event would sort to the end and render as 00:00:00. Skip it.
		if (!commit.commit.author) {
			continue;
		}
		events.push({
			type: "commit",
			ts: new Date(commit.commit.author.date).getTime(),
			title: commit.commit.message.split("\n")[0],
			url: commit.html_url,
			agents: [],
			author: commit.commit.author.name,
		});
	}
	return events.sort((a, b) => b.ts - a.ts).slice(0, MAX_EVENTS);
}
