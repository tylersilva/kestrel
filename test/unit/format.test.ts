import { describe, expect, it } from "vitest";
import {
	corridorLabel,
	formatLocalAmount,
	formatPct,
	formatUsdCompact,
	formatUtcTime,
	patternLabel,
	riskTone,
} from "../../src/lib/format.ts";

describe("format helpers", () => {
	it("formats USD cents compactly", () => {
		expect(formatUsdCompact(123)).toBe("$1.2");
		expect(formatUsdCompact(420_000_00)).toBe("$420K");
		expect(formatUsdCompact(4_200_000_00)).toBe("$4.2M");
	});

	it("formats local minor units per currency conventions", () => {
		expect(formatLocalAmount(12_345, "USD")).toBe("$123.45");
		// JPY is zero-decimal: minor units ARE yen.
		expect(formatLocalAmount(1_240, "JPY")).toBe("¥1,240");
	});

	it("renders UTC clock time regardless of local timezone", () => {
		expect(formatUtcTime(0)).toBe("00:00:00");
		expect(formatUtcTime(45_296_000)).toBe("12:34:56");
	});

	it("labels corridors with city display names", () => {
		expect(corridorLabel("lagos", "nyc")).toBe("Lagos ⇢ New York");
	});

	it("maps risk to temperature tones", () => {
		expect(riskTone(0.2)).toBe("signal");
		expect(riskTone(0.65)).toBe("warn");
		expect(riskTone(0.8)).toBe("alert");
	});

	it("humanizes pattern ids", () => {
		expect(patternLabel("mule_fanout")).toBe("mule fan-out");
		expect(patternLabel(null)).toBe("anomaly");
	});

	it("formats percentages", () => {
		expect(formatPct(0.0143)).toBe("1.4%");
	});
});
