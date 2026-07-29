import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Shell from "./components/chrome/Shell.tsx";
import { useSimClock } from "./hooks/useSimClock.ts";
import { useSimulation } from "./hooks/useSimulation.ts";
import Dashboard from "./pages/Dashboard.tsx";
import { useSimStore } from "./store/sim-store.ts";

// Lazy: keeps recharts out of the main bundle.
const Fleet = lazy(() => import("./pages/Fleet.tsx"));

export default function App() {
	const clock = useSimClock();
	useSimulation(clock);

	useEffect(() => {
		if (clock.failed) {
			useSimStore.getState().setPhase("error");
		}
	}, [clock.failed]);

	return (
		<BrowserRouter>
			<Routes>
				<Route element={<Shell />}>
					<Route index element={<Dashboard />} />
					<Route
						path="/fleet"
						element={
							<Suspense
								fallback={
									<p className="flex min-h-64 items-center justify-center font-mono text-xs text-ink-dim">
										Pulling fleet telemetry…
									</p>
								}
							>
								<Fleet />
							</Suspense>
						}
					/>
					<Route path="*" element={<Dashboard />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
