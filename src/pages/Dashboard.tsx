import AnomalyFeed from "../components/feed/AnomalyFeed.tsx";
import RiskStream from "../components/feed/RiskStream.tsx";
import GlobePanel from "../components/globe/GlobePanel.tsx";
import KpiRow from "../components/kpi/KpiRow.tsx";

export default function Dashboard() {
	return (
		<div className="flex flex-col gap-3">
			<KpiRow />
			<RiskStream />
			<div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
				<GlobePanel />
				<AnomalyFeed />
			</div>
		</div>
	);
}
