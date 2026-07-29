import { describe, expect, it } from "vitest";
import { GLOBAL_SEED } from "../../sim/constants.ts";
import { patternDuration } from "../../sim/engine.ts";
import { episodesForAct } from "../../sim/episodes.ts";
import * as accountTakeover from "../../sim/patterns/account-takeover.ts";
import * as cardTesting from "../../sim/patterns/card-testing.ts";
import * as muleFanout from "../../sim/patterns/mule-fanout.ts";
import * as structuring from "../../sim/patterns/structuring.ts";
import type { EpisodeSpec, TxnDraft } from "../../sim/types.ts";

function spec(overrides: Partial<EpisodeSpec>): EpisodeSpec {
	return {
		pattern: "card_testing",
		actIndex: 0,
		startBucket: 100,
		seed: 0xdecafbad,
		originCity: "lagos",
		targetCity: "nyc",
		intensity: 2,
		...overrides,
	};
}

function emitAll(
	pattern: { DURATION: number; emit(s: EpisodeSpec, b: number): TxnDraft[] },
	s: EpisodeSpec,
): TxnDraft[] {
	const out: TxnDraft[] = [];
	for (let b = s.startBucket; b < s.startBucket + pattern.DURATION; b++) {
		out.push(...pattern.emit(s, b));
	}
	return out;
}

describe("episode scheduler", () => {
	it("stages 1–3 episodes per act with in-act bounds", () => {
		for (let act = 0; act < 50; act++) {
			const episodes = episodesForAct(GLOBAL_SEED, act);
			expect(episodes.length).toBeGreaterThanOrEqual(1);
			expect(episodes.length).toBeLessThanOrEqual(3);
			for (const ep of episodes) {
				expect(ep.startBucket).toBeGreaterThanOrEqual(act * 120);
				expect(
					ep.startBucket + patternDuration(ep.pattern),
				).toBeLessThanOrEqual((act + 1) * 120);
				expect(ep.originCity).not.toBe(ep.targetCity);
				expect(ep.intensity).toBeGreaterThanOrEqual(1);
				expect(ep.intensity).toBeLessThanOrEqual(3);
			}
		}
	});

	it("locks the schedule for the first three acts", () => {
		expect(
			[0, 1, 2].map((act) => episodesForAct(GLOBAL_SEED, act)),
		).toMatchSnapshot();
	});
});

describe("card testing", () => {
	it("bursts tiny card-not-present charges on one corridor, risk ramping", () => {
		const s = spec({ pattern: "card_testing" });
		const txns = emitAll(cardTesting, s);
		expect(txns.length).toBeGreaterThanOrEqual(15);
		for (const t of txns) {
			expect(t.channel).toBe("card_not_present");
			expect(t.usdMinor).toBeLessThanOrEqual(500);
			expect(t.fromCity).toBe("lagos");
			expect(t.toCity).toBe("nyc");
			expect(t.fraudPattern).toBe("card_testing");
		}
		// The burst must get caught by the end.
		expect(txns.some((t) => t.flagged)).toBe(true);
	});
});

describe("account takeover", () => {
	it("probes small and sub-threshold, then wires big", () => {
		const s = spec({ pattern: "account_takeover" });
		const txns = emitAll(accountTakeover, s);
		expect(txns).toHaveLength(2);
		const [probe, wire] = txns;
		expect(probe.usdMinor).toBeLessThanOrEqual(900);
		expect(probe.flagged).toBe(false);
		expect(wire.channel).toBe("wire");
		expect(wire.usdMinor).toBeGreaterThanOrEqual(2_500_000);
	});
});

describe("mule fan-out", () => {
	it("places one inbound then radiates P2P to many distinct cities", () => {
		const s = spec({ pattern: "mule_fanout", originCity: "dubai" });
		const txns = emitAll(muleFanout, s);
		const inbound = txns[0];
		expect(inbound.toCity).toBe("dubai");
		expect(inbound.channel).toBe("wire");
		expect(inbound.flagged).toBe(false); // placement slips through by design
		const fanout = txns.slice(1);
		expect(fanout.length).toBeGreaterThanOrEqual(20);
		const dests = new Set(fanout.map((t) => t.toCity));
		expect(dests.size).toBeGreaterThanOrEqual(8);
		for (const t of fanout) {
			expect(t.fromCity).toBe("dubai");
			expect(t.channel).toBe("p2p");
		}
	});
});

describe("structuring", () => {
	it("drips just-under-$10k wires on a fixed cadence, risk climbing", () => {
		const s = spec({ pattern: "structuring" });
		const txns = emitAll(structuring, s);
		expect(txns.length).toBeGreaterThanOrEqual(15);
		for (const t of txns) {
			expect(t.channel).toBe("wire");
			expect(t.usdMinor).toBeGreaterThanOrEqual(920_000);
			expect(t.usdMinor).toBeLessThanOrEqual(990_000); // always under $10k
		}
		// Early wires slip; later ones trip the threshold.
		expect(txns[0].flagged).toBe(false);
		expect(txns[txns.length - 1].riskScore).toBeGreaterThan(txns[0].riskScore);
		expect(txns.some((t) => t.flagged)).toBe(true);
	});
});
