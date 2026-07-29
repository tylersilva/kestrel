import { cityById, FX } from "../../sim/index.ts";

/**
 * Display formatting. Intl is allowed HERE (client presentation only) and
 * NEVER inside sim/ — locale data must not influence the deterministic world.
 */

const usdCompact = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 1,
});

const compactCount = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

const localFormatters = new Map<string, Intl.NumberFormat>();

/** "$4.2M" from integer USD cents. */
export function formatUsdCompact(usdMinor: number): string {
	return usdCompact.format(usdMinor / 100);
}

/** "128.4K" from a plain count. */
export function formatCountCompact(n: number): string {
	return compactCount.format(n);
}

/** "¥1,240" / "€86.20" from integer minor units of a local currency. */
export function formatLocalAmount(
	amountMinor: number,
	currency: string,
): string {
	let fmt = localFormatters.get(currency);
	if (!fmt) {
		fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
		localFormatters.set(currency, fmt);
	}
	const fx = FX[currency];
	const minorPerUnit = fx ? fx.minorPerUnit : 100;
	return fmt.format(amountMinor / minorPerUnit);
}

/** "14:03:22" — always UTC; every viewer sees the same clock. */
export function formatUtcTime(unixMs: number): string {
	return new Date(unixMs).toISOString().slice(11, 19);
}

/** "0.4%" with one decimal. */
export function formatPct(fraction: number): string {
	return `${(fraction * 100).toFixed(1)}%`;
}

/** "2h 14m" / "38m" / "45s" from a duration in ms. */
export function formatDurationShort(ms: number): string {
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 1) {
		return `${Math.round(ms / 1000)}s`;
	}
	if (minutes < 60) {
		return `${minutes}m`;
	}
	return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** "Lagos ⇢ New York" */
export function corridorLabel(fromCity: string, toCity: string): string {
	return `${cityById(fromCity).name} ⇢ ${cityById(toCity).name}`;
}

export type RiskTone = "signal" | "warn" | "alert";

/** Risk temperature: cool teal → amber → red. */
export function riskTone(risk: number): RiskTone {
	if (risk >= 0.8) {
		return "alert";
	}
	if (risk >= 0.5) {
		return "warn";
	}
	return "signal";
}

const PATTERN_LABELS: Record<string, string> = {
	card_testing: "card testing",
	account_takeover: "account takeover",
	mule_fanout: "mule fan-out",
	structuring: "structuring",
};

export function patternLabel(pattern: string | null): string {
	return pattern ? (PATTERN_LABELS[pattern] ?? pattern) : "anomaly";
}
