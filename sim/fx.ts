/**
 * Static FX snapshot for the simulated world. Rates are frozen forever —
 * they are part of the deterministic contract, not market data. Amounts are
 * generated in USD cents first (the KPI currency), then localized.
 */

export interface FxInfo {
	/** USD per one unit of the currency (frozen snapshot). */
	readonly usdPerUnit: number;
	/** Minor units per unit (100 for cents; 1 for zero-decimal currencies). */
	readonly minorPerUnit: number;
}

export const FX: Readonly<Record<string, FxInfo>> = {
	AED: { usdPerUnit: 0.272, minorPerUnit: 100 },
	ARS: { usdPerUnit: 0.0011, minorPerUnit: 100 },
	AUD: { usdPerUnit: 0.66, minorPerUnit: 100 },
	BRL: { usdPerUnit: 0.19, minorPerUnit: 100 },
	CAD: { usdPerUnit: 0.73, minorPerUnit: 100 },
	CHF: { usdPerUnit: 1.14, minorPerUnit: 100 },
	CLP: { usdPerUnit: 0.0011, minorPerUnit: 1 },
	CNY: { usdPerUnit: 0.14, minorPerUnit: 100 },
	COP: { usdPerUnit: 0.00025, minorPerUnit: 100 },
	EUR: { usdPerUnit: 1.09, minorPerUnit: 100 },
	GBP: { usdPerUnit: 1.27, minorPerUnit: 100 },
	HKD: { usdPerUnit: 0.128, minorPerUnit: 100 },
	IDR: { usdPerUnit: 0.000063, minorPerUnit: 1 },
	ILS: { usdPerUnit: 0.27, minorPerUnit: 100 },
	INR: { usdPerUnit: 0.012, minorPerUnit: 100 },
	JPY: { usdPerUnit: 0.0067, minorPerUnit: 1 },
	KRW: { usdPerUnit: 0.00073, minorPerUnit: 1 },
	MXN: { usdPerUnit: 0.055, minorPerUnit: 100 },
	NGN: { usdPerUnit: 0.00065, minorPerUnit: 100 },
	NZD: { usdPerUnit: 0.61, minorPerUnit: 100 },
	PEN: { usdPerUnit: 0.27, minorPerUnit: 100 },
	PHP: { usdPerUnit: 0.018, minorPerUnit: 100 },
	PLN: { usdPerUnit: 0.25, minorPerUnit: 100 },
	SAR: { usdPerUnit: 0.267, minorPerUnit: 100 },
	SEK: { usdPerUnit: 0.095, minorPerUnit: 100 },
	SGD: { usdPerUnit: 0.74, minorPerUnit: 100 },
	THB: { usdPerUnit: 0.028, minorPerUnit: 100 },
	TRY: { usdPerUnit: 0.029, minorPerUnit: 100 },
	TWD: { usdPerUnit: 0.031, minorPerUnit: 100 },
	USD: { usdPerUnit: 1, minorPerUnit: 100 },
	ZAR: { usdPerUnit: 0.054, minorPerUnit: 100 },
};

export interface Money {
	readonly usdMinor: number;
	readonly amountMinor: number;
	readonly currency: string;
}

/** Convert integer USD cents into a local-currency amount (integer minor units). */
export function localize(usdMinor: number, currency: string): Money {
	const fx = FX[currency];
	if (!fx) {
		throw new Error(`No FX entry for currency: ${currency}`);
	}
	const units = usdMinor / 100 / fx.usdPerUnit;
	const amountMinor = Math.max(1, Math.round(units * fx.minorPerUnit));
	return { usdMinor, amountMinor, currency };
}
