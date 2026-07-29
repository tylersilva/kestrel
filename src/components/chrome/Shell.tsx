import { NavLink, Outlet } from "react-router";
import { useSimStore } from "../../store/sim-store.ts";

const NAV_CLASS = ({ isActive }: { isActive: boolean }) =>
	`px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors ${
		isActive ? "text-ink" : "text-ink-dim hover:text-ink"
	}`;

function StatusPill() {
	const phase = useSimStore((s) => s.phase);
	const progress = useSimStore((s) => s.syncProgress);

	const dot =
		phase === "live"
			? "bg-signal animate-pulse"
			: phase === "error"
				? "bg-alert"
				: "bg-warn";
	const label =
		phase === "live"
			? "live"
			: phase === "syncing"
				? `syncing ${Math.round(progress * 100)}%`
				: phase === "error"
					? "offline"
					: "connecting";

	return (
		<span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 font-mono text-[10px] tracking-[0.15em] text-ink-dim uppercase">
			<span className={`size-1.5 rounded-full ${dot}`} />
			{label}
		</span>
	);
}

export default function Shell() {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
				<div className="flex items-baseline gap-3">
					<NavLink
						to="/"
						className="font-mono text-lg font-semibold tracking-[0.3em] text-ink"
					>
						KESTREL
					</NavLink>
					<span className="hidden font-mono text-[9px] tracking-[0.3em] text-ink-dim uppercase sm:inline">
						Transaction Intelligence
					</span>
				</div>
				<nav className="flex items-center gap-1">
					<NavLink to="/" end className={NAV_CLASS}>
						Overview
					</NavLink>
					<NavLink to="/fleet" className={NAV_CLASS}>
						Fleet
					</NavLink>
				</nav>
				<div className="flex items-center gap-2">
					<StatusPill />
					<span className="rounded border border-warn/40 bg-warn/10 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-warn uppercase">
						Simulated data
					</span>
				</div>
			</header>
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
				<Outlet />
			</main>
			<footer className="border-t border-line px-6 py-3 text-center font-mono text-[10px] tracking-[0.15em] text-ink-dim">
				Built by an agent fleet ·{" "}
				<a
					className="underline decoration-line underline-offset-4 hover:text-ink"
					href="https://github.com/tylersilva/kestrel"
				>
					github.com/tylersilva/kestrel
				</a>
			</footer>
		</div>
	);
}
