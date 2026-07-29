export type Channel =
	| "card_present"
	| "card_not_present"
	| "ach"
	| "wire"
	| "p2p";

export type FraudPatternId =
	| "card_testing"
	| "account_takeover"
	| "mule_fanout"
	| "structuring";

export interface Transaction {
	/** Stable id: `<bucketIndex hex>-<hash hex>` — identical on every client. */
	readonly id: string;
	/** Unix ms, always inside the bucket's 5s window. */
	readonly ts: number;
	readonly fromCity: string;
	readonly toCity: string;
	/** Integer minor units of `currency` (no floats in money). */
	readonly amountMinor: number;
	/** ISO 4217 code — the origin city's local market currency. */
	readonly currency: string;
	/** Integer USD cents — the cross-currency value used by every KPI. */
	readonly usdMinor: number;
	readonly channel: Channel;
	/** 0..1, exactly two decimals. */
	readonly riskScore: number;
	/** flagged === riskScore >= 0.80 (the detection threshold). */
	readonly flagged: boolean;
	/** null for legitimate traffic. */
	readonly fraudPattern: FraudPatternId | null;
}

/** A scheduled fraud episode inside one 10-minute act. */
export interface EpisodeSpec {
	readonly pattern: FraudPatternId;
	readonly actIndex: number;
	readonly startBucket: number;
	/** Per-episode seed — patterns derive all their draws from this. */
	readonly seed: number;
	readonly originCity: string;
	readonly targetCity: string;
	/** 1..3 — scales txn counts within a pattern. */
	readonly intensity: number;
}

export interface KpiSnapshot {
	readonly fromBucket: number;
	readonly toBucket: number;
	readonly txnCount: number;
	/** Total moved value, integer USD cents. */
	readonly volumeUsdMinor: number;
	readonly flaggedCount: number;
	/** Transactions belonging to a fraud pattern. */
	readonly fraudCount: number;
	/** Fraud transactions that were flagged (caught). */
	readonly fraudCaught: number;
	readonly fraudCaughtUsdMinor: number;
	/** Legitimate transactions incorrectly flagged. */
	readonly falsePositives: number;
	/** Fraud transactions that slipped under the threshold. */
	readonly missedFraud: number;
}

/** The detection threshold: riskScore >= FLAG_THRESHOLD ⇒ flagged. */
export const FLAG_THRESHOLD = 0.8;

/** A transaction before the engine stamps its stable id. */
export type TxnDraft = Omit<Transaction, "id">;
