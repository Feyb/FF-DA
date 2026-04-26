/// <reference types="jasmine" />

import { DraftPlayerRow } from "../../core/models";
import { resolveDraftTier, resolveDraftValue } from "./draft-ranking.util";

function buildRow(overrides: Partial<DraftPlayerRow> = {}): DraftPlayerRow {
  return {
    playerId: "p1",
    fullName: "Player One",
    position: "QB",
    team: "KC",
    age: 25,
    yearsExp: null,
    rookie: false,
    ktcValue: 1000,
    ktcRank: 10,
    ktcPositionalRank: 2,
    overallTier: 2,
    positionalTier: 1,
    flockAverageTier: 3,
    flockAveragePositionalTier: 2,
    flockAveragePositionalRank: 3,
    averageRank: 12,
    flockRookieRank: null,
    flockRookieTier: null,
    sleeperRank: 20,
    combinedTier: 3,
    combinedPositionalTier: 2,
    adpRank: 15,
    adpDelta: 1,
    valueGap: 1,
    fpAdpRank: 18,
    fantasyCalcValue: null,
    fantasyCalcTrend30Day: null,
    adpMean: null,
    adpStd: null,
    baseValue: null,
    baseValueDivergence: null,
    pAvailAtNext: null,
    tierCliffScore: null,
    weightedCompositeScore: null,
    injuryStatus: null,
    ...overrides,
  };
}

describe("draft-ranking.util", () => {
  describe("resolveDraftTier", () => {
    it("uses flock fallback to KTC tier when flock tier is unavailable", () => {
      const row = buildRow({
        positionalTier: 4,
        overallTier: 8,
        flockAveragePositionalTier: null,
        flockAverageTier: null,
      });
      expect(resolveDraftTier(row, "flock")).toBe(4);
    });

    it("uses rookie flock tier when veteran flock tier is null", () => {
      const row = buildRow({
        positionalTier: 4,
        flockAveragePositionalTier: null,
        flockAverageTier: null,
        flockRookieTier: 1,
      });
      expect(resolveDraftTier(row, "flock")).toBe(1);
    });

    it("prefers veteran flock tier over rookie flock tier when both are present", () => {
      const row = buildRow({
        flockAveragePositionalTier: null,
        flockAverageTier: 3,
        flockRookieTier: 1,
      });
      expect(resolveDraftTier(row, "flock")).toBe(3);
    });

    it("returns MAX_SAFE_INTEGER when no tier data is available", () => {
      const row = buildRow({
        positionalTier: null,
        overallTier: null,
        flockAveragePositionalTier: null,
        flockAverageTier: null,
        flockRookieTier: null,
      });
      expect(resolveDraftTier(row, "flock")).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("averages KTC and flock tiers in average mode", () => {
      const row = buildRow({ positionalTier: 2, flockAveragePositionalTier: 4 });
      expect(resolveDraftTier(row, "average")).toBe(3);
    });
  });

  describe("resolveDraftValue", () => {
    it("uses ktcValue directly for ktcValue source", () => {
      const row = buildRow({ ktcValue: 2500 });
      expect(resolveDraftValue(row, "ktcValue")).toBe(2500);
    });

    it("negates averageRank for averageRank source", () => {
      const row = buildRow({ averageRank: 12, ktcValue: 2500 });
      expect(resolveDraftValue(row, "averageRank")).toBe(-12);
    });

    it("falls back to rookie rank when veteran averageRank is null", () => {
      const row = buildRow({ averageRank: null, flockRookieRank: 5, ktcValue: 2500 });
      expect(resolveDraftValue(row, "averageRank")).toBe(-5);
    });

    it("prefers veteran averageRank over rookie rank when both are present", () => {
      const row = buildRow({ averageRank: 12, flockRookieRank: 5, ktcValue: 2500 });
      expect(resolveDraftValue(row, "averageRank")).toBe(-12);
    });

    it("falls back to ktcValue when both averageRank and rookie rank are unavailable", () => {
      const row = buildRow({ averageRank: null, flockRookieRank: null, ktcValue: 2500 });
      expect(resolveDraftValue(row, "averageRank")).toBe(2500);
    });
  });
});
