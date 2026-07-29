import {
	corridorLabel,
	formatLocalAmount,
	formatUsdCompact,
	formatUtcTime,
	patternLabel,
} from "../../lib/format.ts";
import { useSimStore } from "../../store/sim-store.ts";

const CHIP: Record<string, string> = {
	alert: "border-alert/40 bg-alert/10 text-alert",
	warn: "border-warn/40 bg-warn/10 text-warn",
};

export default function AnomalyFeed() {
	const feed = useSimStore((s) => s.feed);

	return (
		<section className="panel flex min-h-72 flex-col px-4 py-3">
			<h2 className="mb-2 font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
				Anomaly feed · flagged transactions
			</h2>
			{feed.length === 0 ? (
				<p className="my-auto text-center font-mono text-xs text-ink-dim">
					Watching the stream — flagged transactions land here.
				</p>
			) : (
				<ul className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto">
					{feed.map((t) => {
						// Fraud reads red; a false positive reads amber.
						const tone = t.fraudPattern ? "alert" : "warn";
						return (
							<li
								key={t.id}
								className="row-enter flex items-center gap-3 rounded border border-line/60 px-2.5 py-1.5"
							>
								<span className="font-mono text-[10px] text-ink-dim tabular-nums">
									{formatUtcTime(t.ts)}
								</span>
								<span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
									{corridorLabel(t.fromCity, t.toCity)}
								</span>
								<span
									className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase ${CHIP[tone]}`}
								>
									{patternLabel(t.fraudPattern)}
								</span>
								<span className="text-right font-mono text-xs text-ink tabular-nums">
									{formatLocalAmount(t.amountMinor, t.currency)}
									{t.currency !== "USD" && (
										<span className="block text-[9px] text-ink-dim">
											≈ {formatUsdCompact(t.usdMinor)}
										</span>
									)}
								</span>
								<span className="font-mono text-xs font-semibold text-alert tabular-nums">
									{t.riskScore.toFixed(2)}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
