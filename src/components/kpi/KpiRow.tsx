import {
	formatCountCompact,
	formatPct,
	formatUsdCompact,
} from "../../lib/format.ts";
import { useSimStore } from "../../store/sim-store.ts";

interface TileProps {
	label: string;
	value: string;
	detail: string;
	tone?: "signal" | "warn";
}

function Tile({ label, value, detail, tone }: TileProps) {
	return (
		<div className="panel flex flex-col gap-1.5 px-4 py-3.5">
			<span className="font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
				{label}
			</span>
			<span
				className={`font-mono text-3xl font-semibold tabular-nums ${
					tone === "signal"
						? "text-signal"
						: tone === "warn"
							? "text-warn"
							: "text-ink"
				}`}
			>
				{value}
			</span>
			<span className="font-mono text-[11px] text-ink-dim tabular-nums">
				{detail}
			</span>
		</div>
	);
}

export default function KpiRow() {
	const kpi = useSimStore((s) => s.kpi);
	const phase = useSimStore((s) => s.phase);
	const risk = useSimStore((s) => s.risk);

	// Never render zeros as if they were data — blank until genuinely live.
	const syncing = phase !== "live";
	const legit = kpi.txnCount - kpi.fraudCount;
	const fpRate = legit > 0 ? kpi.falsePositives / legit : 0;
	const detectionRate =
		kpi.episodesTotal > 0 ? kpi.episodesDetected / kpi.episodesTotal : 0;

	// Live txns/min from the trailing minute of the risk ring.
	const trailing = risk.slice(-12);
	const txnsPerMin =
		trailing.length > 0
			? Math.round(
					(trailing.reduce((s, p) => s + p.txnCount, 0) / trailing.length) * 12,
				)
			: 0;

	const v = (s: string) => (syncing ? "—" : s);

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<Tile
				label="Value protected · today"
				value={v(formatUsdCompact(kpi.fraudCaughtUsdMinor))}
				detail={v(`${formatCountCompact(kpi.fraudCaught)} flagged fraud txns`)}
				tone="signal"
			/>
			<Tile
				label="Fraud events detected"
				value={v(String(kpi.episodesDetected))}
				detail={v(
					`${formatPct(detectionRate)} of ${kpi.episodesTotal} episodes`,
				)}
			/>
			<Tile
				label="Transactions · today"
				value={v(formatCountCompact(kpi.txnCount))}
				detail={v(
					`${txnsPerMin}/min · ${formatUsdCompact(kpi.volumeUsdMinor)} moved`,
				)}
			/>
			<Tile
				label="False-positive rate"
				value={v(formatPct(fpRate))}
				detail={v(
					`${formatCountCompact(kpi.falsePositives)} legit txns flagged`,
				)}
				tone="warn"
			/>
		</div>
	);
}
