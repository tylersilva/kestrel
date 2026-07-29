export default function Fleet() {
	return (
		<div className="panel flex min-h-96 flex-col items-center justify-center gap-4 px-6 text-center">
			<span className="font-mono text-[10px] tracking-[0.3em] text-ink-dim uppercase">
				Agent fleet
			</span>
			<p className="max-w-md font-mono text-sm text-ink">
				Fleet telemetry comes online in Phase 4 — a live view of the agents that
				build this product.
			</p>
			<p className="max-w-md text-xs text-ink-dim">
				Until then the raw evidence lives in the repository: issues planned by
				agents, pull requests written and reviewed by agents, deploys landing on
				merge.
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
