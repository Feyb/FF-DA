/// <reference types="jasmine" />

import { __test__, computeTierCliff, TierCliffPlayer } from "./tier-cliff.util";

describe("tier-cliff.util", () => {
  describe("jenksBreaks", () => {
    it("splits a clearly bimodal distribution near the gap", () => {
      const values = [1, 2, 3, 4, 50, 51, 52, 53];
      const breaks = __test__.jenksBreaks(values, 2);
      expect(breaks.length).toBe(1);
      // The break should fall between index 3 (value 4) and 4 (value 50).
      expect(breaks[0]).toBe(4);
    });

    it("returns empty array if numClasses is 1 or N <= numClasses", () => {
      expect(__test__.jenksBreaks([1, 2, 3], 1)).toEqual([]);
      expect(__test__.jenksBreaks([1, 2], 3)).toEqual([]);
    });
  });

  describe("computeTierCliff", () => {
    function buildPool(values: number[], pos = "WR"): TierCliffPlayer[] {
      return values.map((v, i) => ({
        playerId: `${pos}${i}`,
        position: pos,
        baseValue: v,
        pAvailAtNext: 0.5,
      }));
    }

    it("assigns tier 1 to the highest-baseValue cluster", () => {
      const players = buildPool([90, 88, 85, 60, 58, 56, 30, 28, 26, 5, 3, 1, 50, 70, 35]);
      const { tierByPlayer } = computeTierCliff(players);
      const tierForBest = tierByPlayer.get("WR0")?.tier;
      const tierForWorst = tierByPlayer.get("WR11")?.tier;
      expect(tierForBest).toBeDefined();
      expect(tierForWorst).toBeDefined();
      if (tierForBest !== undefined && tierForWorst !== undefined) {
        expect(tierForBest).toBeLessThan(tierForWorst);
      }
    });

    it("computes a positive cliff when the next tier is materially worse", () => {
      // 4 players in tier 1 around 90, 3 players in tier 2 around 50.
      // Ensure the computed cliff is positive for tier-1 members when peers
      // are likely-gone (low pAvailAtNext).
      const players: TierCliffPlayer[] = [
        { playerId: "a", position: "WR", baseValue: 92, pAvailAtNext: 0.05 },
        { playerId: "b", position: "WR", baseValue: 91, pAvailAtNext: 0.05 },
        { playerId: "c", position: "WR", baseValue: 90, pAvailAtNext: 0.05 },
        { playerId: "d", position: "WR", baseValue: 89, pAvailAtNext: 0.05 },
        { playerId: "e", position: "WR", baseValue: 51, pAvailAtNext: 0.5 },
        { playerId: "f", position: "WR", baseValue: 50, pAvailAtNext: 0.5 },
        { playerId: "g", position: "WR", baseValue: 49, pAvailAtNext: 0.5 },
      ];
      const { tierCliffByPlayer } = computeTierCliff(players, { tierCount: () => 2 });
      const cliffA = tierCliffByPlayer.get("a") ?? 0;
      expect(cliffA).toBeGreaterThan(0);
      // tier-2 players have no next tier to drop to; cliff should be 0.
      expect(tierCliffByPlayer.get("e")).toBe(0);
    });

    it("never reports a negative cliff", () => {
      const players = buildPool([10, 20, 30, 40, 50, 60, 70, 80]);
      const { tierCliffByPlayer } = computeTierCliff(players);
      for (const v of tierCliffByPlayer.values()) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });

    it("isolates positions from each other", () => {
      const players: TierCliffPlayer[] = [
        ...buildPool([90, 80, 50, 40], "WR"),
        ...buildPool([95, 30], "QB"),
      ];
      const { tierByPlayer } = computeTierCliff(players);
      const wrTiers = new Set(["WR0", "WR1", "WR2", "WR3"].map((id) => tierByPlayer.get(id)?.tier));
      const qbTiers = new Set(["QB0", "QB1"].map((id) => tierByPlayer.get(id)?.tier));
      // Both positions should produce at least 2 distinct tiers despite being independent pools.
      expect(wrTiers.size).toBeGreaterThanOrEqual(2);
      expect(qbTiers.size).toBeGreaterThanOrEqual(2);
    });

    it("ignores players with null baseValue", () => {
      const players: TierCliffPlayer[] = [
        { playerId: "a", position: "WR", baseValue: 90, pAvailAtNext: 0.5 },
        { playerId: "b", position: "WR", baseValue: null, pAvailAtNext: 0.5 },
        { playerId: "c", position: "WR", baseValue: 30, pAvailAtNext: 0.5 },
      ];
      const { tierByPlayer } = computeTierCliff(players);
      expect(tierByPlayer.has("b")).toBe(false);
    });
  });
});
