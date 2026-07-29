import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Shell from "./components/chrome/Shell.tsx";
import { useSimClock } from "./hooks/useSimClock.ts";
import { useSimulation } from "./hooks/useSimulation.ts";
import Dashboard from "./pages/Dashboard.tsx";
import Fleet from "./pages/Fleet.tsx";
import { useSimStore } from "./store/sim-store.ts";

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
					<Route path="/fleet" element={<Fleet />} />
					<Route path="*" element={<Dashboard />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
