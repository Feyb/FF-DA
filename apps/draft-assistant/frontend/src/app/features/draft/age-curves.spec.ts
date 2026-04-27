/// <reference types="jasmine" />

import { getAgeMult } from "./age-curves";

describe("age-curves — getAgeMult", () => {
  describe("RB", () => {
    it("returns peak multiplier at age 24 in startup mode (^1.0)", () => {
      expect(getAgeMult("RB", 24, "startup")).toBeCloseTo(1.1, 4);
    });

    it("returns 1.0 at age 26 in startup mode", () => {
      expect(getAgeMult("RB", 26, "startup")).toBeCloseTo(1.0, 4);
    });

    it("returns 0.78 at age 28 in startup mode", () => {
      expect(getAgeMult("RB", 28, "startup")).toBeCloseTo(0.78, 4);
    });

    it("applies redraft exponent (^0.25) — flattens the curve", () => {
      const startup = getAgeMult("RB", 28, "startup"); // 0.78^1.0 = 0.78
      const redraft = getAgeMult("RB", 28, "redraft"); // 0.78^0.25 ≈ 0.94
      expect(redraft).toBeGreaterThan(startup);
      expect(redraft).toBeCloseTo(Math.pow(0.78, 0.25), 3);
    });

    it("applies rookie exponent (^0.5)", () => {
      expect(getAgeMult("RB", 24, "rookie")).toBeCloseTo(Math.pow(1.1, 0.5), 4);
    });

    it("interpolates linearly for fractional ages (24.5 between 24 and 25)", () => {
      const lo = getAgeMult("RB", 24, "startup"); // 1.10
      const hi = getAgeMult("RB", 25, "startup"); // 1.08
      const mid = getAgeMult("RB", 24.5, "startup");
      expect(mid).toBeCloseTo((1.1 + 1.08) / 2, 4);
      // Must be strictly between
      expect(mid).toBeLessThan(lo);
      expect(mid).toBeGreaterThan(hi);
    });

    it("clamps to minimum table value for ages below range", () => {
      expect(getAgeMult("RB", 18, "startup")).toBeCloseTo(getAgeMult("RB", 21, "startup"), 4);
    });

    it("clamps to maximum table value for ages above range", () => {
      expect(getAgeMult("RB", 45, "startup")).toBeCloseTo(getAgeMult("RB", 32, "startup"), 4);
    });
  });

  describe("WR", () => {
    it("returns peak at age 26 in startup mode", () => {
      expect(getAgeMult("WR", 26, "startup")).toBeCloseTo(1.1, 4);
    });

    it("returns 1.10 at age 26 (post-peak plateau start)", () => {
      expect(getAgeMult("WR", 26, "startup")).toBeCloseTo(1.1, 4);
    });
  });

  describe("TE", () => {
    it("returns peak at age 27 in startup mode", () => {
      expect(getAgeMult("TE", 27, "startup")).toBeCloseTo(1.1, 4);
    });
  });

  describe("QB — pocket vs dual-threat", () => {
    it("pocket QB peaks at age 29-30", () => {
      expect(getAgeMult("QB", 29, "startup")).toBeCloseTo(1.1, 4);
      expect(getAgeMult("QB", 30, "startup")).toBeCloseTo(1.1, 4);
    });

    it("dual-threat QB peaks earlier at age 24-25", () => {
      const dualPeak = getAgeMult("QB", 24, "startup", true);
      const pocketAtSameAge = getAgeMult("QB", 24, "startup", false);
      expect(dualPeak).toBeGreaterThan(pocketAtSameAge);
    });

    it("dual-threat QB declines faster from age 27 onward", () => {
      const dual27 = getAgeMult("QB", 27, "startup", true);
      const pocket27 = getAgeMult("QB", 27, "startup", false);
      expect(dual27).toBeLessThan(pocket27);
    });
  });

  describe("unknown position", () => {
    it("returns 1.0 for an unknown position", () => {
      expect(getAgeMult("K", 25, "startup")).toBe(1.0);
    });

    it("returns 1.0 when age is null", () => {
      expect(getAgeMult("RB", null, "startup")).toBe(1.0);
    });
  });
});
