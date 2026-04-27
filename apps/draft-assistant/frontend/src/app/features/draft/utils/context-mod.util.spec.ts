/// <reference types="jasmine" />

import { contextModFor, buildContextModMap, ContextModInputs } from "./context-mod.util";

function base(overrides: Partial<ContextModInputs> = {}): ContextModInputs {
  return {
    playerId: "p1",
    position: "WR",
    age: 25,
    nflRound: null,
    yearsExp: 5,
    effScore: null,
    ...overrides,
  };
}

describe("context-mod.util", () => {
  describe("contextModFor", () => {
    it("returns 1.0 for a veteran WR with null age, round, and effScore", () => {
      // ageMult=1.0 (null age), capMult=1.0 (veteran), effMult=1.0 (null)
      const mod = contextModFor(
        base({ age: null, nflRound: null, yearsExp: 5, effScore: null }),
        "startup",
      );
      expect(mod).toBeCloseTo(1.0, 4);
    });

    it("gives a first-round rookie WR a multiplier above 1 in startup mode", () => {
      const rookie = contextModFor(
        base({ position: "WR", age: 22, nflRound: 1, yearsExp: 0, effScore: null }),
        "startup",
      );
      // ageMult(WR, 22, startup) = 0.98; capMult(WR, R1, exp=0) = 1.25 → product > 1
      expect(rookie).toBeGreaterThan(1.0);
    });

    it("boosts an elite-efficiency player (effScore=+2) by up to 30%", () => {
      const effMod = contextModFor(base({ effScore: 2.0 }), "startup");
      const baseMod = contextModFor(base({ effScore: null }), "startup");
      expect(effMod / baseMod).toBeCloseTo(1.3, 2);
    });

    it("reduces an inefficient player (effScore=-2) by up to 30%", () => {
      const effMod = contextModFor(base({ effScore: -2.0 }), "startup");
      const baseMod = contextModFor(base({ effScore: null }), "startup");
      expect(effMod / baseMod).toBeCloseTo(0.7, 2);
    });

    it("applies scheme-fit when provided", () => {
      const withFit = contextModFor(base({ schemeFit: 1.0 }), "startup");
      const withoutFit = contextModFor(base({ schemeFit: null }), "startup");
      // schemeMult = 1 + 0.10 * 1.0 = 1.10
      expect(withFit / withoutFit).toBeCloseTo(1.1, 4);
    });

    it("clamps scheme-fit to [-1, +1]", () => {
      const maxFit = contextModFor(base({ schemeFit: 5.0 }), "startup");
      const clampedFit = contextModFor(base({ schemeFit: 1.0 }), "startup");
      expect(maxFit).toBeCloseTo(clampedFit, 4);
    });

    it("applies a weaker age curve in redraft mode vs startup", () => {
      // An aging RB (28) has a severe startup penalty, much less in redraft.
      const startup = contextModFor(base({ position: "RB", age: 28, yearsExp: 6 }), "startup");
      const redraft = contextModFor(base({ position: "RB", age: 28, yearsExp: 6 }), "redraft");
      expect(redraft).toBeGreaterThan(startup);
    });

    it("dual-threat QB flag changes the age curve", () => {
      // Dual-threat curve peaks earlier (age 24-25) vs pocket QB (29-30)
      const dual = contextModFor(
        base({ position: "QB", age: 24, yearsExp: 2, isDualThreat: true }),
        "startup",
      );
      const pocket = contextModFor(
        base({ position: "QB", age: 24, yearsExp: 2, isDualThreat: false }),
        "startup",
      );
      expect(dual).toBeGreaterThan(pocket);
    });
  });

  describe("buildContextModMap", () => {
    it("returns a map with an entry for every input player", () => {
      const inputs = [base({ playerId: "a" }), base({ playerId: "b", age: 28, position: "RB" })];
      const map = buildContextModMap(inputs, "startup");
      expect(map.size).toBe(2);
      expect(map.has("a")).toBeTrue();
      expect(map.has("b")).toBeTrue();
    });

    it("values are all positive numbers", () => {
      const inputs = [
        base({ playerId: "a", effScore: 2 }),
        base({ playerId: "b", effScore: -2 }),
        base({ playerId: "c", age: null, nflRound: null }),
      ];
      const map = buildContextModMap(inputs, "startup");
      for (const [, v] of map) {
        expect(v).toBeGreaterThan(0);
        expect(Number.isFinite(v)).toBeTrue();
      }
    });
  });
});
