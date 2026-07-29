import { useSimStore } from "../../store/sim-store.ts";

const W = 480;
const H = 72;
const PAD = 8;

const y = (risk: number) => PAD + (1 - risk) * (H - PAD * 2);

/**
 * The world's risk heartbeat: average risk per 5s bucket over the trailing
 * ten minutes, hand-rolled SVG. Red markers are buckets where something
 * crossed the 0.80 threshold.
 */
export default function RiskStream() {
	const risk = useSimStore((s) => s.risk);

	const points = risk
		.map(
			(p, i) =>
				`${((i / Math.max(1, risk.length - 1)) * W).toFixed(1)},${y(p.avgRisk).toFixed(1)}`,
		)
		.join(" ");

	const alerts = risk
		.map((p, i) => ({ p, i }))
		.filter(({ p }) => p.flaggedCount > 0);

	return (
		<section className="panel px-4 py-3">
			<div className="mb-2 flex items-baseline justify-between">
				<h2 className="font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
					World risk · trailing 10 min
				</h2>
				<span className="font-mono text-[10px] text-ink-dim tabular-nums">
					threshold 0.80
				</span>
			</div>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				className="h-20 w-full"
				role="img"
				aria-label="Average transaction risk over the trailing ten minutes"
			>
				<line
					x1="0"
					y1={y(0.8)}
					x2={W}
					y2={y(0.8)}
					stroke="var(--color-alert)"
					strokeOpacity="0.35"
					strokeDasharray="4 4"
					strokeWidth="1"
				/>
				{points && (
					<polyline
						points={points}
						fill="none"
						stroke="var(--color-signal)"
						strokeWidth="1.5"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				)}
				{alerts.map(({ p, i }) => (
					<circle
						key={p.bucketIndex}
						cx={(i / Math.max(1, risk.length - 1)) * W}
						cy={y(p.maxRisk)}
						r="2.5"
						fill="var(--color-alert)"
					/>
				))}
			</svg>
		</section>
	);
}
