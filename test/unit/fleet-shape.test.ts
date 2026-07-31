import { describe, expect, it } from "vitest";
import type { FleetEvent } from "../../worker/lib/fleet-shape.ts";
import {
	AGENT_ROLES,
	agentLabels,
	shapeActivity,
	shapePrBoard,
	shapeSummary,
	shapeVelocity,
} from "../../worker/lib/fleet-shape.ts";
import type { GhCommit, GhIssue, GhPull } from "../../worker/lib/github.ts";

const PULLS: GhPull[] = [
	{
		number: 2,
		title: "feat: engine",
		state: "closed",
		created_at: "2026-07-29T00:00:00Z",
		merged_at: "2026-07-29T01:00:00Z",
		labels: [{ name: "agent:builder" }, { name: "area:sim" }],
		user: { login: "tylersilva" },
		html_url: "https://github.com/x/2",
		draft: false,
	},
	{
		number: 4,
		title: "feat: dashboard",
		state: "closed",
		created_at: "2026-07-29T02:00:00Z",
		merged_at: "2026-07-29T05:00:00Z",
		labels: [{ name: "agent:builder" }],
		user: { login: "tylersilva" },
		html_url: "https://github.com/x/4",
		draft: false,
	},
	{
		number: 6,
		title: "feat: wip",
		state: "open",
		created_at: "2026-07-29T06:00:00Z",
		merged_at: null,
		labels: [],
		user: null,
		html_url: "https://github.com/x/6",
		draft: false,
	},
];

const ISSUES: GhIssue[] = [
	{
		number: 1,
		title: "plan: engine",
		state: "closed",
		created_at: "2026-07-28T23:00:00Z",
		labels: [{ name: "agent:planner" }],
		user: { login: "tylersilva" },
		html_url: "https://github.com/x/1",
	},
	{
		number: 3,
		title: "plan: open thing",
		state: "open",
		created_at: "2026-07-29T03:00:00Z",
		labels: [{ name: "agent:planner" }, { name: "agent:reviewer" }],
		user: { login: "tylersilva" },
		html_url: "https://github.com/x/3",
	},
	// PRs leak into the issues endpoint — must be excluded everywhere.
	{
		number: 2,
		title: "feat: engine",
		state: "closed",
		created_at: "2026-07-29T00:00:00Z",
		labels: [{ name: "agent:builder" }],
		user: { login: "tylersilva" },
		html_url: "https://github.com/x/2",
		pull_request: {},
	},
];

const COMMITS: GhCommit[] = [
	{
		sha: "abc",
		commit: {
			message: "Add engine\n\nlong body",
			author: { name: "Claude", date: "2026-07-29T00:30:00Z" },
		},
		html_url: "https://github.com/x/c/abc",
	},
	{
		sha: "def",
		commit: { message: "Fix things", author: null },
		html_url: "https://github.com/x/c/def",
	},
];

/** Builds a minimal FleetEvent fixture, defaulting to a merged-PR shape. */
function mkEvent(
	overrides: Omit<Partial<FleetEvent>, "ts"> & { ts: string },
): FleetEvent {
	return {
		type: "pr_merged",
		title: "feat: something",
		url: "https://github.com/x/9",
		agents: [],
		author: "tylersilva",
		...overrides,
		ts: new Date(overrides.ts).getTime(),
	};
}

describe("fleet shaping", () => {
	it("parses agent labels, ignoring unknown ones", () => {
		expect(
			agentLabels([
				{ name: "agent:builder" },
				{ name: "agent:builder" },
				{ name: "agent:mystery" },
				{ name: "type:feature" },
			]),
		).toEqual(["builder"]);
	});

	it("summarizes PRs, issues, commits with per-agent counts", () => {
		const s = shapeSummary(PULLS, ISSUES, COMMITS);
		expect(s.totalPrs).toBe(3);
		expect(s.mergedPrs).toBe(2);
		expect(s.mergeRatePct).toBe(67);
		// Merge times: 1h and 3h → median 2h.
		expect(s.medianTimeToMergeMs).toBe(2 * 3_600_000);
		expect(s.commitCount).toBe(2);
		expect(s.openIssues).toBe(1); // the leaked PR doesn't count
		expect(s.agents).toEqual({
			planner: 2,
			builder: 2, // from the two labeled PRs, NOT the leaked issue-PR
			reviewer: 1,
			tester: 0,
		});
		expect(s.activeAgents).toBe(3);
	});

	it("builds the PR board with merged state resolution", () => {
		const board = shapePrBoard(PULLS, 2);
		expect(board).toHaveLength(2);
		expect(board[0].state).toBe("merged");
		expect(board[0].agents).toEqual(["builder"]);
	});

	it("orders activity newest-first and excludes leaked PR-issues", () => {
		const events = shapeActivity(PULLS, ISSUES, COMMITS);
		const tss = events.map((e) => e.ts);
		expect([...tss].sort((a, b) => b - a)).toEqual(tss);
		expect(events.filter((e) => e.type === "issue_opened")).toHaveLength(2);
		expect(events.filter((e) => e.type === "pr_merged")).toHaveLength(2);
		const commit = events.find(
			(e) => e.type === "commit" && e.author === "Claude",
		);
		expect(commit?.title).toBe("Add engine"); // first line only
	});

	// Regression lock for the planner's spot-check (issue #9): shapeSummary's
	// per-role tally iterates agentLabels()'s result, so an empty array is
	// already a correct zero-iteration no-op. This pins that down so it can't
	// silently regress alongside the shapeVelocity fix below.
	it("does not credit an unlabeled merged PR to any role in shapeSummary", () => {
		const unlabeledMerged: GhPull[] = [
			{
				number: 42,
				title: "fix: something",
				state: "closed",
				created_at: "2026-07-30T00:00:00Z",
				merged_at: "2026-07-30T01:00:00Z",
				labels: [],
				user: { login: "tylersilva" },
				html_url: "https://github.com/x/42",
				draft: false,
			},
		];
		const s = shapeSummary(unlabeledMerged, [], []);
		expect(s.mergedPrs).toBe(1);
		expect(s.agents).toEqual({
			planner: 0,
			builder: 0,
			reviewer: 0,
			tester: 0,
		});
		expect(s.activeAgents).toBe(0);
	});
});

describe("shapeVelocity", () => {
	it("excludes a merged PR with no agent:* label entirely", () => {
		const events = [mkEvent({ ts: "2026-07-29T01:00:00Z", agents: [] })];
		expect(shapeVelocity(events)).toEqual([]);
	});

	it("still counts a merged PR with a genuine role label", () => {
		const events = [
			mkEvent({ ts: "2026-07-29T01:00:00Z", agents: ["builder"] }),
		];
		expect(shapeVelocity(events)).toEqual([
			{ day: "2026-07-29", planner: 0, builder: 1, reviewer: 0, tester: 0 },
		]);
	});

	it("counts a different role label correctly too", () => {
		const events = [
			mkEvent({ ts: "2026-07-29T01:00:00Z", agents: ["reviewer"] }),
		];
		expect(shapeVelocity(events)).toEqual([
			{ day: "2026-07-29", planner: 0, builder: 0, reviewer: 1, tester: 0 },
		]);
	});

	it("on a mixed same day, credits only the labeled merge — not both, not double", () => {
		const events = [
			mkEvent({ ts: "2026-07-29T01:00:00Z", agents: ["builder"] }),
			mkEvent({ ts: "2026-07-29T05:00:00Z", agents: [] }),
		];
		const rows = shapeVelocity(events);
		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row).toEqual({
			day: "2026-07-29",
			planner: 0,
			builder: 1,
			reviewer: 0,
			tester: 0,
		});
		// Total across all role columns is 1, not 2 — the unlabeled merge
		// contributed nothing.
		const total = AGENT_ROLES.reduce((sum, role) => sum + row[role], 0);
		expect(total).toBe(1);
	});

	it("ignores non-pr_merged events regardless of their agents field", () => {
		const events: FleetEvent[] = [
			mkEvent({
				type: "issue_opened",
				ts: "2026-07-29T01:00:00Z",
				agents: ["builder"],
			}),
			mkEvent({
				type: "pr_opened",
				ts: "2026-07-29T02:00:00Z",
				agents: ["builder"],
			}),
			mkEvent({
				type: "commit",
				ts: "2026-07-29T03:00:00Z",
				agents: ["builder"],
			}),
		];
		expect(shapeVelocity(events)).toEqual([]);
	});
});
