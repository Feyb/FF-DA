/// <reference types="jasmine" />

import { computeVnp, VnpPlayer } from "./vnp.util";

const SCALE = 20;

// pAvailFn that always returns 1.0 (every player always available).
const alwaysAvail = (_pickN: number, _mean: number, _std: number) => 1.0;

// pAvailFn that always returns 0.0 (no player available).
const neverAvail = (_pickN: number, _mean: number, _std: number) => 0.0;

function player(
  overrides: Partial<VnpPlayer> & { playerId: string; projection: number },
): VnpPlayer {
  return {
    position: "WR",
    adpMean: 50,
    adpStd: 10,
    ...overrides,
  };
}

describe("vnp.util — computeVnp", () => {
  it("returns 0 for a sole player at a position (is its own expected best)", () => {
    const players = [player({ playerId: "p1", projection: 80 })];
    const result = computeVnp(players, 10, alwaysAvail, SCALE);
    // best at WR = 80; vnp = (80 - 80) / 20 = 0
    expect(result.get("p1")).toBeCloseTo(0, 4);
  });

  it("best player has VNP 0 (is its own expected best); lesser players have negative VNP proportional to the gap", () => {
    const players = [
      player({ playerId: "p1", projection: 90 }),
      player({ playerId: "p2", projection: 60 }),
    ];
    const result = computeVnp(players, 10, alwaysAvail, SCALE);
    // best = 90 (p1 is available); p1 vnp = (90-90)/20 = 0; p2 vnp = (60-90)/20 = -1.5
    expect(result.get("p1")).toBeCloseTo(0, 4);
    expect(result.get("p2")).toBeCloseTo(-1.5, 4);
  });

  it("returns positive VNP when top player is unlikely to survive to next pick", () => {
    // pAvailFn returns < 0.5 for first player (p1) but >= 0.5 for p2.
    const pAvailByPlayer: Record<string, number> = { p1: 0.1, p2: 0.9 };
    const pAvailFn = (_pickN: number, mean: number, _std: number) =>
      pAvailByPlayer[mean === 20 ? "p1" : "p2"] ?? 0;

    const players = [
      player({ playerId: "p1", projection: 90, adpMean: 20 }),
      player({ playerId: "p2", projection: 60, adpMean: 80 }),
    ];
    const result = computeVnp(players, 15, pAvailFn, SCALE);
    // Expected best at WR at nextPick = 60 (p1 unlikely to survive, p2 survives)
    // p1 vnp = (90 - 60) / 20 = +1.5 (take him now!)
    expect(result.get("p1")).toBeCloseTo(1.5, 4);
    // p2 vnp = (60 - 60) / 20 = 0
    expect(result.get("p2")).toBeCloseTo(0, 4);
  });

  it("returns 0 for all players when no one is likely available at next pick", () => {
    const players = [
      player({ playerId: "p1", projection: 80 }),
      player({ playerId: "p2", projection: 50 }),
    ];
    const result = computeVnp(players, 10, neverAvail, SCALE);
    // bestAtPos = null → vnp = 0 for all
    expect(result.get("p1")).toBeCloseTo(0, 4);
    expect(result.get("p2")).toBeCloseTo(0, 4);
  });

  it("handles multiple positions independently", () => {
    const players = [
      player({ playerId: "wr1", projection: 80, position: "WR" }),
      player({ playerId: "rb1", projection: 70, position: "RB" }),
    ];
    const result = computeVnp(players, 10, alwaysAvail, SCALE);
    // Each is the only player at their position → VNP = 0
    expect(result.get("wr1")).toBeCloseTo(0, 4);
    expect(result.get("rb1")).toBeCloseTo(0, 4);
  });

  it("skips players with null projection", () => {
    const players: VnpPlayer[] = [
      { playerId: "p1", position: "WR", projection: null, adpMean: 50, adpStd: 10 },
      player({ playerId: "p2", projection: 60 }),
    ];
    const result = computeVnp(players, 10, alwaysAvail, SCALE);
    expect(result.has("p1")).toBeFalse();
    expect(result.get("p2")).toBeCloseTo(0, 4);
  });

  it("respects the scale parameter", () => {
    const players = [
      player({ playerId: "p1", projection: 80 }),
      player({ playerId: "p2", projection: 60 }),
    ];
    const scale10 = computeVnp(players, 10, alwaysAvail, 10);
    const scale40 = computeVnp(players, 10, alwaysAvail, 40);
    // p2 vnp with scale 10 should be double p2 vnp with scale 20
    expect(scale10.get("p2")).toBeCloseTo(-2, 4);
    expect(scale40.get("p2")).toBeCloseTo(-0.5, 4);
  });
});
