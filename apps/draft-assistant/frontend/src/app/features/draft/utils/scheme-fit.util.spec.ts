import {
  computeSchemeFit,
  buildSchemeFitMap,
  schemeFitMult,
  SchemeFitInputs,
} from "./scheme-fit.util";

function makeInputs(overrides: Partial<SchemeFitInputs> = {}): SchemeFitInputs {
  return {
    playerId: "p1",
    position: "WR",
    team: "KC",
    aDot: null,
    snapShare: null,
    depthChartOrder: null,
    ...overrides,
  };
}

describe("computeSchemeFit", () => {
  it("returns 0 for unknown team", () => {
    expect(computeSchemeFit(makeInputs({ team: "XYZ" }))).toBe(0);
  });

  it("returns 0 for null team", () => {
    expect(computeSchemeFit(makeInputs({ team: null }))).toBe(0);
  });

  it("returns a value in [-1, +1]", () => {
    const teams = ["KC", "BUF", "MIA", "BAL", "TEN", "SF", "PIT", "CIN"];
    const positions = ["WR", "RB", "TE", "QB"];
    for (const team of teams) {
      for (const position of positions) {
        const score = computeSchemeFit(makeInputs({ team, position }));
        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("WR scores higher in elite pass-volume system (BUF) than in run-heavy system (TEN)", () => {
    const wr_buf = computeSchemeFit(makeInputs({ team: "BUF", position: "WR" }));
    const wr_ten = computeSchemeFit(makeInputs({ team: "TEN", position: "WR" }));
    expect(wr_buf).toBeGreaterThan(wr_ten);
  });

  it("RB scores higher in run-heavy system (TEN) than in elite pass system (BUF)", () => {
    const rb_ten = computeSchemeFit(makeInputs({ team: "TEN", position: "RB" }));
    const rb_buf = computeSchemeFit(makeInputs({ team: "BUF", position: "RB" }));
    expect(rb_ten).toBeGreaterThan(rb_buf);
  });

  it("deep-route WR (aDOT >= 12) fits high-concentration system better", () => {
    // CIN has passConc: "high"; SF has passConc: "low"
    const deep_cin = computeSchemeFit(makeInputs({ team: "CIN", position: "WR", aDot: 14 }));
    const deep_sf = computeSchemeFit(makeInputs({ team: "SF", position: "WR", aDot: 14 }));
    expect(deep_cin).toBeGreaterThan(deep_sf);
  });

  it("QB scores higher in hurry-up pass system (MIA) than in slow run-heavy (TEN)", () => {
    const qb_mia = computeSchemeFit(makeInputs({ team: "MIA", position: "QB" }));
    const qb_ten = computeSchemeFit(makeInputs({ team: "TEN", position: "QB" }));
    expect(qb_mia).toBeGreaterThan(qb_ten);
  });

  it("is case-insensitive for team abbreviation", () => {
    const upper = computeSchemeFit(makeInputs({ team: "KC" }));
    const lower = computeSchemeFit(makeInputs({ team: "kc" }));
    expect(upper).toBeCloseTo(lower, 10);
  });
});

describe("schemeFitMult", () => {
  it("returns 1.0 for neutral fit (0)", () => {
    expect(schemeFitMult(0)).toBeCloseTo(1.0);
  });

  it("returns 1.1 for perfect fit (+1)", () => {
    expect(schemeFitMult(1)).toBeCloseTo(1.1);
  });

  it("returns 0.9 for adverse fit (−1)", () => {
    expect(schemeFitMult(-1)).toBeCloseTo(0.9);
  });
});

describe("buildSchemeFitMap", () => {
  it("returns a map entry for every input", () => {
    const inputs: SchemeFitInputs[] = [
      makeInputs({ playerId: "a", team: "KC" }),
      makeInputs({ playerId: "b", team: "TEN", position: "RB" }),
      makeInputs({ playerId: "c", team: null }),
    ];
    const map = buildSchemeFitMap(inputs);
    expect(map.size).toBe(3);
    expect(map.get("c")).toBe(0);
  });
});
