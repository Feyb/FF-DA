/// <reference types="jasmine" />

import { ExplanationSignals, generateExplanation } from "./score-explanation.util";

function buildSignals(overrides: Partial<ExplanationSignals> = {}): ExplanationSignals {
  return {
    baseValue: 70,
    baseValueDivergence: 0.3,
    pAvailAtNext: 0.5,
    tierCliffScore: 0,
    nextTierMeanBaseValue: null,
    thisTierMeanBaseValue: null,
    tier: null,
    adpDelta: 0,
    adpMean: null,
    currentPickNumber: 24,
    age: null,
    position: "WR",
    positionRunCount: 0,
    positionRunWindow: 6,
    ...overrides,
  };
}

describe("score-explanation.util", () => {
  it("returns empty string when no signals fire", () => {
    expect(generateExplanation(buildSignals())).toBe("");
  });

  it("flags a faller when adpDelta is large and pAvailAtNext is low", () => {
    const out = generateExplanation(
      buildSignals({ adpDelta: 5, adpMean: 18, pAvailAtNext: 0.1, currentPickNumber: 24 }),
    );
    expect(out).toContain("Falling");
    expect(out).toContain("ADP 18");
    expect(out).toContain("pick 24");
  });

  it("does not flag a faller when player is likely to be available next pick", () => {
    const out = generateExplanation(
      buildSignals({ adpDelta: 5, adpMean: 30, pAvailAtNext: 0.95, currentPickNumber: 24 }),
    );
    expect(out).not.toContain("Falling");
  });

  it("flags a tier cliff with a non-zero next-tier delta", () => {
    const out = generateExplanation(
      buildSignals({
        tierCliffScore: 6,
        thisTierMeanBaseValue: 80,
        nextTierMeanBaseValue: 55,
        tier: 2,
      }),
    );
    expect(out).toContain("Tier 2 cliff");
    expect(out).toContain("25");
  });

  it("flags a position run when 3+ in the last 6 picks", () => {
    const out = generateExplanation(
      buildSignals({ position: "RB", positionRunCount: 4, positionRunWindow: 6 }),
    );
    expect(out).toContain("RB run");
    expect(out).toContain("4 of last 6");
  });

  it("flags young rising-side age for an RB age 22", () => {
    const out = generateExplanation(buildSignals({ position: "RB", age: 22 }));
    expect(out).toContain("Young (22)");
  });

  it("flags age risk for a 30-year-old RB", () => {
    const out = generateExplanation(buildSignals({ position: "RB", age: 30 }));
    expect(out).toContain("Age risk");
  });

  it("respects maxClauses cap", () => {
    const out = generateExplanation(
      buildSignals({
        adpDelta: 5,
        adpMean: 18,
        pAvailAtNext: 0.1,
        tierCliffScore: 6,
        thisTierMeanBaseValue: 80,
        nextTierMeanBaseValue: 55,
        tier: 1,
        position: "RB",
        positionRunCount: 4,
        positionRunWindow: 6,
        age: 22,
      }),
      { maxClauses: 2 },
    );
    expect(out.split(" \u2022 ").length).toBe(2);
  });

  it("surfaces divergence flag only when there is also a positive adpDelta", () => {
    const withValue = generateExplanation(buildSignals({ baseValueDivergence: 1.0, adpDelta: 3 }));
    expect(withValue).toContain("Splits rankings");

    const withoutValue = generateExplanation(buildSignals({ baseValueDivergence: 1.0 }));
    expect(withoutValue).not.toContain("Splits rankings");
  });

  describe("template #12 — QB stack synergy", () => {
    it("fires for a WR whose team QB is on the user roster", () => {
      const out = generateExplanation(
        buildSignals({ position: "WR", stackSynergyQbName: "P. Mahomes" }),
      );
      expect(out).toContain("QB stack with P. Mahomes");
    });

    it("does not fire for a QB (self-stack guard)", () => {
      const out = generateExplanation(
        buildSignals({ position: "QB", stackSynergyQbName: "P. Mahomes" }),
      );
      expect(out).not.toContain("QB stack");
    });

    it("does not fire when stackSynergyQbName is null", () => {
      const out = generateExplanation(buildSignals({ stackSynergyQbName: null }));
      expect(out).not.toContain("QB stack");
    });
  });

  describe("template #17 — Sleeper trending adds", () => {
    it("fires when trendingAdds is non-null", () => {
      const out = generateExplanation(buildSignals({ trendingAdds: 4500 }));
      expect(out).toContain("Trending");
      expect(out).toContain("4,500");
    });

    it("does not fire when trendingAdds is null", () => {
      const out = generateExplanation(buildSignals({ trendingAdds: null }));
      expect(out).not.toContain("Trending");
    });
  });

  describe("template #21 — injury designation", () => {
    it("fires with magnitude 20 for Out status", () => {
      const out = generateExplanation(buildSignals({ injuryStatus: "Out" }));
      expect(out).toContain("🏥 Out");
    });

    it("fires with magnitude 20 for IR status", () => {
      const out = generateExplanation(buildSignals({ injuryStatus: "IR" }));
      expect(out).toContain("🏥 IR");
    });

    it("fires with magnitude 15 for Doubtful status", () => {
      const out = generateExplanation(buildSignals({ injuryStatus: "Doubtful" }));
      expect(out).toContain("🏥 Doubtful");
    });

    it("fires with magnitude 10 for Questionable status", () => {
      const out = generateExplanation(buildSignals({ injuryStatus: "Questionable" }));
      expect(out).toContain("🏥 Questionable");
    });

    it("does not fire when injuryStatus is null", () => {
      const out = generateExplanation(buildSignals({ injuryStatus: null }));
      expect(out).not.toContain("🏥");
    });

    it("injury (Out) takes precedence over lower-magnitude clauses", () => {
      // Out magnitude=20 should beat position-run magnitude ~20 and young-age magnitude=8
      const out = generateExplanation(
        buildSignals({
          injuryStatus: "Out",
          position: "RB",
          age: 22,
          positionRunCount: 4,
          positionRunWindow: 6,
        }),
        { maxClauses: 1 },
      );
      expect(out).toContain("🏥 Out");
    });
  });
});
