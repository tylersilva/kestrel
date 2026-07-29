import AnomalyFeed from "../components/feed/AnomalyFeed.tsx";
import CorridorBoard from "../components/feed/CorridorBoard.tsx";
import RiskStream from "../components/feed/RiskStream.tsx";
import KpiRow from "../components/kpi/KpiRow.tsx";

export default function Dashboard() {
	return (
		<div className="flex flex-col gap-3">
			<KpiRow />
			<RiskStream />
			<div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
				<CorridorBoard />
				<AnomalyFeed />
			</div>
		</div>
	);
}
