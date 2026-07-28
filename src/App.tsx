import { useEffect, useState } from "react";

type Health = { ok: boolean; engineVersion: string; serverTime: number };

export default function App() {
	const [health, setHealth] = useState<Health | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		fetch("/api/health")
			.then((r) => r.json() as Promise<Health>)
			.then(setHealth)
			.catch(() => setFailed(true));
	}, []);

	return (
		<main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
			<span className="absolute top-4 right-4 rounded border border-warn/40 bg-warn/10 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-warn uppercase">
				Simulated data
			</span>

			<h1 className="font-mono text-5xl font-semibold tracking-[0.35em] text-ink sm:text-7xl">
				KESTREL
			</h1>
			<p className="text-sm tracking-[0.3em] text-ink-dim uppercase">
				Transaction Intelligence
			</p>

			<div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 font-mono text-xs text-ink-dim">
				{health ? (
					<>
						<span className="size-2 animate-pulse rounded-full bg-signal" />
						systems nominal · engine v{health.engineVersion}
					</>
				) : failed ? (
					<>
						<span className="size-2 rounded-full bg-alert" />
						api unreachable
					</>
				) : (
					<>
						<span className="size-2 rounded-full bg-ink-dim" />
						connecting…
					</>
				)}
			</div>

			<footer className="absolute bottom-6 text-xs text-ink-dim">
				Built by an agent fleet ·{" "}
				<a
					className="underline decoration-line underline-offset-4 hover:text-ink"
					href="https://github.com/tylersilva/kestrel"
				>
					github.com/tylersilva/kestrel
				</a>
			</footer>
		</main>
	);
}
