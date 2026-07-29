import {
	corridorLabel,
	formatLocalAmount,
	riskTone,
} from "../../lib/format.ts";
import { useSimStore } from "../../store/sim-store.ts";

const DOT: Record<string, string> = {
	alert: "bg-alert",
	warn: "bg-warn",
	signal: "bg-signal",
};

const CHANNEL_LABEL: Record<string, string> = {
	card_present: "card",
	card_not_present: "card·cnp",
	ach: "ach",
	wire: "wire",
	p2p: "p2p",
};

/**
 * Departures board for the world's money: every recent transaction as a
 * corridor row. This panel is the globe's seat — Phase 3 replaces the board
 * with the 3D mesh; the same stream will feed it.
 */
export default function CorridorBoard() {
	const recent = useSimStore((s) => s.recent);

	return (
		<section className="panel corridor-grid flex min-h-72 flex-col px-4 py-3">
			<div className="mb-2 flex items-baseline justify-between">
				<h2 className="font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
					Live corridors
				</h2>
				<span className="font-mono text-[10px] text-ink-dim">
					global mesh comes online in phase 3
				</span>
			</div>
			{recent.length === 0 ? (
				<p className="my-auto text-center font-mono text-xs text-ink-dim">
					Opening the stream…
				</p>
			) : (
				<ul className="flex flex-col gap-1">
					{recent.slice(0, 14).map((t) => {
						const tone = riskTone(t.riskScore);
						return (
							<li
								key={t.id}
								className="row-enter flex items-center gap-3 px-1 py-1"
							>
								<span className={`size-1.5 rounded-full ${DOT[tone]}`} />
								<span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
									{corridorLabel(t.fromCity, t.toCity)}
								</span>
								<span className="font-mono text-[10px] tracking-[0.1em] text-ink-dim uppercase">
									{CHANNEL_LABEL[t.channel] ?? t.channel}
								</span>
								<span className="font-mono text-sm text-ink-dim tabular-nums">
									{formatLocalAmount(t.amountMinor, t.currency)}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
