/// <reference types="jasmine" />

import { computeEffScores, getEffMultiplier, EffScoreInputs } from "./efficiency-score.util";

function wrBase(id: string, overrides: Partial<EffScoreInputs> = {}): EffScoreInputs {
  return {
    playerId: id,
    position: "WR",
    games: 16,
    wopr: 0.4,
    routeRate: 0.75,
    yprr: 1.8,
    tprr: 0.25,
    aDot: 10,
    ...overrides,
  };
}

function rbBase(id: string, overrides: Partial<EffScoreInputs> = {}): EffScoreInputs {
  return {
    playerId: id,
    position: "RB",
    games: 16,
    weightedOpportunity: 180,
    routeRate: 0.4,
    snapPct: 0.6,
    yacoPerAtt: 3.5,
    brokenTacklesPerAtt: 0.15,
    ...overrides,
  };
}

function qbBase(id: string, overrides: Partial<EffScoreInputs> = {}): EffScoreInputs {
  return {
    playerId: id,
    position: "QB",
    games: 16,
    epaPerDropback: 0.1,
    cpoe: 3.5,
    rushEpa: 0.05,
    ...overrides,
  };
}

describe("efficiency-score.util", () => {
  describe("computeEffScores", () => {
    it("returns null for players with fewer than 6 games", () => {
      const inputs = [wrBase("p1"), wrBase("p2", { games: 3 })];
      const result = computeEffScores(inputs);
      expect(result.get("p2")).toBeNull();
    });

    it("returns a finite score for a WR with 6+ games", () => {
      const result = computeEffScores([wrBase("p1")]);
      const score = result.get("p1");
      expect(score).not.toBeNull();
      expect(Number.isFinite(score as number)).toBeTrue();
    });

    it("ranks elite WR above average WR", () => {
      const inputs = [
        wrBase("elite", { wopr: 0.6, yprr: 2.8, tprr: 0.4, routeRate: 0.9 }),
        wrBase("avg", { wopr: 0.3, yprr: 1.2, tprr: 0.18, routeRate: 0.6 }),
        wrBase("bench", { wopr: 0.15, yprr: 0.8, tprr: 0.1, routeRate: 0.5 }),
      ];
      const result = computeEffScores(inputs);
      expect(result.get("elite")!).toBeGreaterThan(result.get("avg")!);
      expect(result.get("avg")!).toBeGreaterThan(result.get("bench")!);
    });

    it("ranks elite RB above average RB on weighted_opportunity", () => {
      const inputs = [
        rbBase("workhorse", { weightedOpportunity: 280, snapPct: 0.75 }),
        rbBase("committee", { weightedOpportunity: 100, snapPct: 0.35 }),
      ];
      const result = computeEffScores(inputs);
      expect(result.get("workhorse")!).toBeGreaterThan(result.get("committee")!);
    });

    it("computes z-scores within position groups (positional-relative, not cross-position)", () => {
      // A WR pool and an RB pool scored together — each position z-normed separately.
      const inputs = [
        wrBase("wr1", { wopr: 0.6 }),
        wrBase("wr2", { wopr: 0.2 }),
        rbBase("rb1", { weightedOpportunity: 300 }),
        rbBase("rb2", { weightedOpportunity: 100 }),
      ];
      const result = computeEffScores(inputs);
      // Within each group, the top player should be > 0 and bottom < 0.
      expect(result.get("wr1")!).toBeGreaterThan(0);
      expect(result.get("wr2")!).toBeLessThan(0);
      expect(result.get("rb1")!).toBeGreaterThan(0);
      expect(result.get("rb2")!).toBeLessThan(0);
    });

    it("returns a score of 0 for a single-player pool (zero variance)", () => {
      const result = computeEffScores([wrBase("solo")]);
      expect(result.get("solo")).toBe(0);
    });

    it("ranks elite QB above below-average QB", () => {
      const inputs = [
        qbBase("elite", { epaPerDropback: 0.25, cpoe: 6.0, rushEpa: 0.2 }),
        qbBase("poor", { epaPerDropback: -0.1, cpoe: -3.0, rushEpa: -0.1 }),
      ];
      const result = computeEffScores(inputs);
      expect(result.get("elite")!).toBeGreaterThan(result.get("poor")!);
    });

    it("returns null for a QB with missing EPA data", () => {
      const result = computeEffScores([{ playerId: "q1", position: "QB", games: 16 }]);
      expect(result.get("q1")).toBeNull();
    });

    it("handles a TE pool using route rate and TPRR", () => {
      const inputs: EffScoreInputs[] = [
        {
          playerId: "te1",
          position: "TE",
          games: 16,
          routeRate: 0.7,
          tprr: 0.3,
          yprr: 1.8,
          targetShare: 0.2,
        },
        {
          playerId: "te2",
          position: "TE",
          games: 16,
          routeRate: 0.4,
          tprr: 0.12,
          yprr: 0.9,
          targetShare: 0.08,
        },
      ];
      const result = computeEffScores(inputs);
      expect(result.get("te1")!).toBeGreaterThan(result.get("te2")!);
    });
  });

  describe("getEffMultiplier", () => {
    it("returns 1.0 for null effScore", () => {
      expect(getEffMultiplier(null)).toBe(1.0);
    });

    it("returns 1.30 at effScore = +2.0 (upper clamp)", () => {
      expect(getEffMultiplier(2.0)).toBeCloseTo(1.3, 5);
    });

    it("returns 0.70 at effScore = -2.0 (lower clamp)", () => {
      expect(getEffMultiplier(-2.0)).toBeCloseTo(0.7, 5);
    });

    it("clamps values beyond ±2 to the boundary", () => {
      expect(getEffMultiplier(5)).toBeCloseTo(1.3, 5);
      expect(getEffMultiplier(-5)).toBeCloseTo(0.7, 5);
    });

    it("interpolates linearly for values within range", () => {
      // effScore = 1.0 → 1 + 0.15 * 1.0 = 1.15
      expect(getEffMultiplier(1.0)).toBeCloseTo(1.15, 5);
    });
  });
});
