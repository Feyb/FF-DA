/// <reference types="jasmine" />

import { DraftPlayerRow } from "../../core/models";
import {
  positionalRankForSortSource,
  rankForSortSource,
  sortBySortSource,
} from "./draft-sort.util";

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
    rookieScore: null,
    schemeFit: null,
    dominatorRating: null,
    breakoutAge: null,
    ras: null,
    landingVacatedTargetPct: null,
    ...overrides,
  };
}

describe("draft-sort.util", () => {
  describe("sortBySortSource", () => {
    it("sorts combinedTier ascending and uses sleeperRank as a tiebreaker", () => {
      const a = buildRow({ playerId: "a", combinedTier: 2, sleeperRank: 50 });
      const b = buildRow({ playerId: "b", combinedTier: 2, sleeperRank: 10 });
      const c = buildRow({ playerId: "c", combinedTier: 1, sleeperRank: 30 });

      const sorted = [a, b, c].sort((left, right) => sortBySortSource(left, right, "combinedTier"));
      expect(sorted.map((row) => row.playerId)).toEqual(["c", "b", "a"]);
    });

    it("sorts adpDelta descending and keeps null values last", () => {
      const high = buildRow({ playerId: "high", adpDelta: 8 });
      const mid = buildRow({ playerId: "mid", adpDelta: 2 });
      const none = buildRow({ playerId: "none", adpDelta: null });

      const sorted = [mid, none, high].sort((left, right) =>
        sortBySortSource(left, right, "adpDelta"),
      );
      expect(sorted.map((row) => row.playerId)).toEqual(["high", "mid", "none"]);
    });

    it("sorts valueGap descending and keeps null values last", () => {
      const high = buildRow({ playerId: "high", valueGap: 3 });
      const low = buildRow({ playerId: "low", valueGap: 1 });
      const none = buildRow({ playerId: "none", valueGap: null });

      const sorted = [none, low, high].sort((left, right) =>
        sortBySortSource(left, right, "valueGap"),
      );
      expect(sorted.map((row) => row.playerId)).toEqual(["high", "low", "none"]);
    });
  });

  describe("rankForSortSource", () => {
    it("maps each sort source to the expected rank field", () => {
      const row = buildRow({
        combinedTier: 7,
        sleeperRank: 11,
        ktcRank: 13,
        averageRank: 17,
        combinedPositionalTier: 19,
        adpDelta: 23,
        valueGap: 29,
        fpAdpRank: 31,
      });

      expect(rankForSortSource(row, "combinedTier")).toBe(7);
      expect(rankForSortSource(row, "sleeperRank")).toBe(11);
      expect(rankForSortSource(row, "ktcRank")).toBe(13);
      expect(rankForSortSource(row, "flockRank")).toBe(17);
      expect(rankForSortSource(row, "combinedPositionalTier")).toBe(19);
      expect(rankForSortSource(row, "adpDelta")).toBe(23);
      expect(rankForSortSource(row, "valueGap")).toBe(29);
      expect(rankForSortSource(row, "fpAdpRank")).toBe(31);
    });
  });

  describe("positionalRankForSortSource", () => {
    it("returns positional values for sources that support them", () => {
      const row = buildRow({
        combinedPositionalTier: 4,
        positionalTier: 5,
        flockAveragePositionalTier: 6,
      });

      expect(positionalRankForSortSource(row, "combinedTier")).toBe(4);
      expect(positionalRankForSortSource(row, "ktcRank")).toBe(5);
      expect(positionalRankForSortSource(row, "flockRank")).toBe(6);
      expect(positionalRankForSortSource(row, "combinedPositionalTier")).toBe(4);
    });

    it("returns null for sources without positional rank", () => {
      const row = buildRow();

      expect(positionalRankForSortSource(row, "sleeperRank")).toBeNull();
      expect(positionalRankForSortSource(row, "adpDelta")).toBeNull();
      expect(positionalRankForSortSource(row, "valueGap")).toBeNull();
      expect(positionalRankForSortSource(row, "fpAdpRank")).toBeNull();
    });
  });
});
