/// <reference types="jasmine" />

import { getCapitalMult } from "./capital-mult";

describe("capital-mult — getCapitalMult", () => {
  describe("WR", () => {
    it("returns 1.25 for round 1 rookie", () => {
      expect(getCapitalMult("WR", 1, 0)).toBe(1.25);
    });

    it("returns 1.15 for round 2 rookie", () => {
      expect(getCapitalMult("WR", 2, 0)).toBe(1.15);
    });

    it("returns 0.95 for round 3 rookie", () => {
      expect(getCapitalMult("WR", 3, 1)).toBe(0.95);
    });

    it("returns 0.7 for round 7 rookie", () => {
      expect(getCapitalMult("WR", 7, 1)).toBe(0.7);
    });

    it("returns 0.7 for UDFA (round 8)", () => {
      expect(getCapitalMult("WR", 8, 0)).toBe(0.7);
    });
  });

  describe("RB", () => {
    it("returns 1.25 for round 1 rookie", () => {
      expect(getCapitalMult("RB", 1, 0)).toBe(1.25);
    });

    it("returns 0.9 for round 3 rookie", () => {
      expect(getCapitalMult("RB", 3, 1)).toBe(0.9);
    });
  });

  describe("TE", () => {
    it("returns 1.25 for round 1 rookie", () => {
      expect(getCapitalMult("TE", 1, 0)).toBe(1.25);
    });

    it("returns 0.7 for round 7 rookie", () => {
      expect(getCapitalMult("TE", 7, 0)).toBe(0.7);
    });
  });

  describe("QB", () => {
    it("returns 1.3 for round 1 (highest — starting job scarcity)", () => {
      expect(getCapitalMult("QB", 1, 0)).toBe(1.3);
    });

    it("returns 0.8 for round 3", () => {
      expect(getCapitalMult("QB", 3, 1)).toBe(0.8);
    });
  });

  describe("veteran override (yearsExp > 2)", () => {
    it("returns 1.0 regardless of round when yearsExp = 3", () => {
      expect(getCapitalMult("WR", 1, 3)).toBe(1.0);
      expect(getCapitalMult("RB", 1, 3)).toBe(1.0);
      expect(getCapitalMult("TE", 1, 3)).toBe(1.0);
      expect(getCapitalMult("QB", 1, 3)).toBe(1.0);
    });

    it("returns 1.0 for a high yearsExp veteran regardless of round", () => {
      expect(getCapitalMult("WR", 1, 10)).toBe(1.0);
    });
  });

  describe("null / unknown inputs", () => {
    it("returns 1.0 when nflRound is null (veteran with unknown draft data)", () => {
      expect(getCapitalMult("WR", null, 0)).toBe(1.0);
    });

    it("returns 1.0 when yearsExp is null (treats as potentially eligible)", () => {
      // null yearsExp — falls through to round lookup
      expect(getCapitalMult("WR", 1, null)).toBe(1.25);
    });

    it("returns 1.0 for an unknown position", () => {
      expect(getCapitalMult("K", 1, 0)).toBe(1.0);
    });

    it("clamps round < 1 to round 1", () => {
      expect(getCapitalMult("WR", 0, 0)).toBe(1.25);
    });

    it("clamps round > 8 to UDFA multiplier", () => {
      expect(getCapitalMult("WR", 99, 0)).toBe(0.7);
    });
  });
});
