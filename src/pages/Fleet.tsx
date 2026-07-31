import {
	Bar,
	BarChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { AgentRole, FleetEvent } from "../../worker/lib/fleet-shape.ts";
import { shapeVelocity } from "../../worker/lib/fleet-shape.ts";
import { useFleetData } from "../hooks/useFleetData.ts";
import { formatDurationShort, formatUtcTime } from "../lib/format.ts";

const AGENT_COLOR: Record<AgentRole, string> = {
	planner: "#8b5cf6",
	builder: "#2de0c2",
	reviewer: "#f2b13d",
	tester: "#3b82f6",
};

const ROLES: AgentRole[] = ["planner", "builder", "reviewer", "tester"];

const EVENT_DOT: Record<string, string> = {
	issue_opened: "bg-[#8b5cf6]",
	pr_opened: "bg-signal",
	pr_merged: "bg-ink",
};

function Tile({
	label,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail: string;
}) {
	return (
		<div className="panel flex flex-col gap-1.5 px-4 py-3.5">
			<span className="font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
				{label}
			</span>
			<span className="font-mono text-3xl font-semibold text-ink tabular-nums">
				{value}
			</span>
			<span className="font-mono text-[11px] text-ink-dim tabular-nums">
				{detail}
			</span>
		</div>
	);
}

function Swimlanes({ events }: { events: FleetEvent[] }) {
	const laneEvents = events.filter((e) => e.type !== "commit");
	if (laneEvents.length === 0) {
		return null;
	}
	const tss = laneEvents.map((e) => e.ts);
	const min = Math.min(...tss);
	const span = Math.max(1, Math.max(...tss) - min);
	return (
		<section className="panel px-4 py-3">
			<h2 className="mb-3 font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
				Agent timeline · every planned issue, built PR, and merge
			</h2>
			<div className="flex flex-col gap-2">
				{ROLES.map((role) => (
					<div key={role} className="flex items-center gap-3">
						<span
							className="w-16 shrink-0 text-right font-mono text-[10px] tracking-[0.1em] uppercase"
							style={{ color: AGENT_COLOR[role] }}
						>
							{role}
						</span>
						<div className="relative h-6 flex-1 rounded border border-line/60">
							{laneEvents
								.filter((e) => e.agents.includes(role))
								.map((e) => (
									<a
										key={`${e.type}-${e.number}-${e.ts}`}
										href={e.url}
										title={`${e.type.replace("_", " ")} · #${e.number} ${e.title}`}
										className={`absolute top-1/2 size-2 -translate-y-1/2 rounded-full ${EVENT_DOT[e.type] ?? "bg-ink-dim"}`}
										style={{
											left: `calc(${(((e.ts - min) / span) * 92 + 2).toFixed(2)}% )`,
										}}
									>
										<span className="sr-only">
											{`${e.type.replace("_", " ")} #${e.number}: ${e.title}`}
										</span>
									</a>
								))}
						</div>
					</div>
				))}
			</div>
			<p className="mt-2 text-right font-mono text-[9px] text-ink-dim">
				<span className="mr-3">● issue planned (violet)</span>
				<span className="mr-3">● PR opened (teal)</span>
				<span>● merged (white)</span>
			</p>
		</section>
	);
}

function Velocity({ events }: { events: FleetEvent[] }) {
	const data = shapeVelocity(events);
	return (
		<section className="panel px-4 py-3">
			<h2 className="mb-3 font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
				Merge velocity · PRs per day by agent
			</h2>
			<div className="h-44">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={data}
						margin={{ top: 4, right: 8, left: -26, bottom: 0 }}
					>
						<XAxis
							dataKey="day"
							tickFormatter={(d: string) => d.slice(5)}
							tick={{ fill: "#8b98ad", fontSize: 10, fontFamily: "monospace" }}
							axisLine={{ stroke: "#1a2233" }}
							tickLine={false}
						/>
						<YAxis
							allowDecimals={false}
							tick={{ fill: "#8b98ad", fontSize: 10, fontFamily: "monospace" }}
							axisLine={{ stroke: "#1a2233" }}
							tickLine={false}
						/>
						<Tooltip
							cursor={{ fill: "rgba(26, 34, 51, 0.4)" }}
							contentStyle={{
								background: "#0b0f17",
								border: "1px solid #1a2233",
								borderRadius: 6,
								fontFamily: "monospace",
								fontSize: 11,
							}}
						/>
						{ROLES.map((role) => (
							<Bar
								key={role}
								dataKey={role}
								stackId="prs"
								fill={AGENT_COLOR[role]}
							/>
						))}
					</BarChart>
				</ResponsiveContainer>
			</div>
		</section>
	);
}

const STATE_CHIP: Record<string, string> = {
	merged: "border-signal/40 bg-signal/10 text-signal",
	open: "border-warn/40 bg-warn/10 text-warn",
	closed: "border-line bg-panel text-ink-dim",
};

export default function Fleet() {
	const { summary, prs, events, meta, failed, loading } = useFleetData();

	if (loading) {
		return (
			<p className="flex min-h-64 items-center justify-center font-mono text-xs text-ink-dim">
				Pulling fleet telemetry…
			</p>
		);
	}

	// Only a page that never got data shows the error panel — a failed
	// REFRESH degrades to a chip below, never blanks what we're holding.
	if (!summary) {
		return (
			<div className="panel flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
				<p className="font-mono text-sm text-ink">
					Fleet telemetry is unreachable right now.
				</p>
				<p className="max-w-md text-xs text-ink-dim">
					The raw evidence is always available on GitHub — issues planned by
					agents, PRs written and reviewed by agents, deploys on merge.
				</p>
				<a
					className="font-mono text-xs text-signal underline decoration-line underline-offset-4 hover:text-ink"
					href="https://github.com/tylersilva/kestrel"
				>
					github.com/tylersilva/kestrel
				</a>
			</div>
		);
	}

	const commits = events.filter((e) => e.type === "commit").slice(0, 12);

	return (
		<div className="flex flex-col gap-3">
			{(failed || (meta && (meta.stale || !meta.authenticated))) && (
				<p className="rounded border border-warn/40 bg-warn/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-warn uppercase">
					{failed
						? "Refresh failed — showing the last good data"
						: meta?.stale
							? "Showing cached data — GitHub refresh is delayed"
							: "Unauthenticated GitHub access — refresh may be rate-limited"}
				</p>
			)}

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<Tile
					label="Pull requests"
					value={String(summary.totalPrs)}
					detail={`${summary.mergeRatePct}% merged`}
				/>
				<Tile
					label="Median time to merge"
					value={
						summary.medianTimeToMergeMs !== null
							? formatDurationShort(summary.medianTimeToMergeMs)
							: "—"
					}
					detail="open → merged"
				/>
				<Tile
					label="Commits"
					value={String(summary.commitCount)}
					detail="on main + branches"
				/>
				<Tile
					label="Open issues"
					value={String(summary.openIssues)}
					detail="queued for the fleet"
				/>
				<Tile
					label="Active agents"
					value={String(summary.activeAgents)}
					detail={ROLES.filter((r) => summary.agents[r] > 0).join(" · ") || "—"}
				/>
			</div>

			<Swimlanes events={events} />
			<Velocity events={events} />

			<div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
				<section className="panel px-4 py-3">
					<h2 className="mb-2 font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
						Pull requests
					</h2>
					<ul className="flex flex-col gap-1.5">
						{prs.map((pr) => (
							<li key={pr.number}>
								<a
									href={pr.url}
									className="flex items-center gap-3 rounded border border-line/60 px-2.5 py-2 transition-colors hover:border-line"
								>
									<span className="font-mono text-[10px] text-ink-dim tabular-nums">
										#{pr.number}
									</span>
									<span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
										{pr.title}
									</span>
									{pr.agents.map((role) => (
										<span
											key={role}
											className="rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase"
											style={{
												color: AGENT_COLOR[role],
												borderColor: `${AGENT_COLOR[role]}66`,
											}}
										>
											{role}
										</span>
									))}
									<span
										className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase ${STATE_CHIP[pr.state]}`}
									>
										{pr.state}
									</span>
								</a>
							</li>
						))}
					</ul>
				</section>

				<section className="panel px-4 py-3">
					<h2 className="mb-2 font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
						Recent commits
					</h2>
					<ul className="flex flex-col gap-1.5">
						{commits.map((c) => (
							<li key={c.url}>
								<a
									href={c.url}
									className="flex items-baseline gap-3 px-1 py-0.5 hover:text-ink"
								>
									<span className="font-mono text-[10px] text-ink-dim tabular-nums">
										{formatUtcTime(c.ts)}
									</span>
									<span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
										{c.title}
									</span>
								</a>
							</li>
						))}
					</ul>
				</section>
			</div>
		</div>
	);
}
