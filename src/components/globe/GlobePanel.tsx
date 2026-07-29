import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { QualityLevel } from "../../lib/globe-data.ts";
import CorridorBoard from "../feed/CorridorBoard.tsx";

const Globe = lazy(() => import("./Globe.tsx"));

const QUALITY_KEY = "kestrel-globe-quality";

function webglAvailable(): boolean {
	try {
		const canvas = document.createElement("canvas");
		return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
	} catch {
		return false;
	}
}

function initialQuality(): QualityLevel {
	try {
		return localStorage.getItem(QUALITY_KEY) === "low" ? "low" : "high";
	} catch {
		return "high";
	}
}

/**
 * The globe's seat: WebGL probe → lazy 3D globe, with the corridor board as
 * both the loading surface and the no-WebGL fallback (the feed stays live
 * either way).
 */
export default function GlobePanel() {
	const [webgl] = useState(webglAvailable);
	const [quality, setQuality] = useState<QualityLevel>(initialQuality);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) {
				setSize({ width: rect.width, height: rect.height });
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const toggleQuality = () => {
		const next: QualityLevel = quality === "high" ? "low" : "high";
		setQuality(next);
		try {
			localStorage.setItem(QUALITY_KEY, next);
		} catch {
			// Private-mode storage failures are fine — the toggle still works.
		}
	};

	if (!webgl) {
		return (
			<div className="flex flex-col gap-2">
				<p className="rounded border border-warn/40 bg-warn/10 px-3 py-2 font-mono text-[11px] text-warn">
					3D rendering isn't available on this device — showing the corridor
					board instead. The stream is identical.
				</p>
				<CorridorBoard />
			</div>
		);
	}

	return (
		<section className="panel relative flex min-h-[28rem] flex-col overflow-hidden">
			<div className="pointer-events-none absolute top-3 right-4 left-4 z-10 flex items-baseline justify-between">
				<h2 className="font-mono text-[10px] tracking-[0.25em] text-ink-dim uppercase">
					Global mesh · live
				</h2>
				<button
					type="button"
					onClick={toggleQuality}
					className="pointer-events-auto rounded border border-line bg-panel px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-ink-dim uppercase transition-colors hover:text-ink"
				>
					quality: {quality}
				</button>
			</div>
			<div ref={containerRef} className="min-h-[28rem] flex-1">
				<Suspense
					fallback={
						<p className="flex h-full items-center justify-center font-mono text-xs text-ink-dim">
							Acquiring the mesh…
						</p>
					}
				>
					{size.width > 0 && (
						<Globe
							quality={quality}
							width={size.width}
							height={Math.max(size.height, 448)}
						/>
					)}
				</Suspense>
			</div>
		</section>
	);
}
