import { useEffect, useMemo, useRef, useState } from "react";
import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { CITIES, type City } from "../../../sim/index.ts";
import { QUALITY, type QualityLevel } from "../../lib/globe-data.ts";
import { useSimStore } from "../../store/sim-store.ts";
import { useGlobeStream } from "./useGlobeStream.ts";

const IDLE_RESUME_MS = 10_000;

interface LandFeatures {
	features: object[];
}

// Fetched once per session, shared across remounts.
let landPromise: Promise<LandFeatures> | null = null;
function loadLand(): Promise<LandFeatures> {
	if (!landPromise) {
		landPromise = fetch("/data/land-110m.json").then(
			(r) => r.json() as Promise<LandFeatures>,
		);
	}
	return landPromise;
}

interface CityPoint {
	readonly lat: number;
	readonly lng: number;
	readonly radius: number;
	readonly city: City;
}

const CITY_POINTS: CityPoint[] = CITIES.map((city) => ({
	lat: city.lat,
	lng: city.lng,
	radius: 0.12 + city.weight * 0.03,
	city,
}));

function cityTooltip(point: object): string {
	const { city } = point as CityPoint;
	const perMin = useSimStore
		.getState()
		.recent.filter(
			(t) => t.fromCity === city.id || t.toCity === city.id,
		).length;
	return `<div style="font-family: ui-monospace, monospace; font-size: 11px; background: #0b0f17; border: 1px solid #1a2233; border-radius: 4px; padding: 6px 8px; color: #e6edf7;">
		${city.name}<span style="color:#8b98ad"> · ${perMin} txns in the last 2 min</span>
	</div>`;
}

export default function Globe({
	quality,
	width,
	height,
}: {
	quality: QualityLevel;
	width: number;
	height: number;
}) {
	const globeRef = useRef<GlobeMethods | undefined>(undefined);
	const { arcs, rings } = useGlobeStream(quality);
	const [land, setLand] = useState<LandFeatures | null>(null);

	const globeMaterial = useMemo(
		() =>
			new MeshPhongMaterial({
				color: "#0a0e16",
				transparent: true,
				opacity: 0.96,
			}),
		[],
	);

	useEffect(() => {
		let cancelled = false;
		loadLand().then((data) => {
			if (!cancelled) {
				setLand(data);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Rotation, pixel clamp, interaction pause, tab-hide pause.
	useEffect(() => {
		const globe = globeRef.current;
		if (!globe) {
			return;
		}
		globe.renderer().setPixelRatio(Math.min(2, window.devicePixelRatio));
		const controls = globe.controls();
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.45;
		controls.enableZoom = true;
		controls.minDistance = 180;

		let idleTimer: ReturnType<typeof setTimeout> | null = null;
		const onInteractStart = () => {
			controls.autoRotate = false;
			if (idleTimer) {
				clearTimeout(idleTimer);
				idleTimer = null;
			}
		};
		const onInteractEnd = () => {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
			idleTimer = setTimeout(() => {
				controls.autoRotate = true;
			}, IDLE_RESUME_MS);
		};
		controls.addEventListener("start", onInteractStart);
		controls.addEventListener("end", onInteractEnd);

		const onVisibility = () => {
			if (document.hidden) {
				globe.pauseAnimation();
			} else {
				globe.resumeAnimation();
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			controls.removeEventListener("start", onInteractStart);
			controls.removeEventListener("end", onInteractEnd);
			document.removeEventListener("visibilitychange", onVisibility);
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
		};
	}, []);

	return (
		<GlobeGL
			ref={globeRef}
			width={width}
			height={height}
			backgroundColor="rgba(0,0,0,0)"
			globeMaterial={globeMaterial}
			showAtmosphere
			atmosphereColor="#2de0c2"
			atmosphereAltitude={0.14}
			hexPolygonsData={land ? land.features : []}
			hexPolygonResolution={QUALITY[quality].hexResolution}
			hexPolygonMargin={0.68}
			hexPolygonColor={() => "rgba(139, 152, 173, 0.35)"}
			pointsData={CITY_POINTS}
			pointLat="lat"
			pointLng="lng"
			pointRadius="radius"
			pointAltitude={0.004}
			pointColor={() => "rgba(139, 152, 173, 0.85)"}
			pointLabel={cityTooltip}
			arcsData={arcs}
			arcStartLat="startLat"
			arcStartLng="startLng"
			arcEndLat="endLat"
			arcEndLng="endLng"
			arcColor="color"
			arcStroke="stroke"
			arcAltitudeAutoScale={0.35}
			arcDashLength={0.5}
			arcDashGap={1}
			arcDashAnimateTime={1_600}
			arcsTransitionDuration={0}
			ringsData={rings}
			ringLat="lat"
			ringLng="lng"
			ringMaxRadius="maxRadius"
			ringPropagationSpeed="speed"
			ringRepeatPeriod={0}
			ringColor={() => (t: number) => `rgba(255, 77, 94, ${1 - t})`}
		/>
	);
}
