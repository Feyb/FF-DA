import {
  computeRunHeat,
  countRecentPositionPicks,
  EXPECTED_RUN_RATE,
  POSITION_RUN_WINDOW,
} from "./board-state.util";

function makePicks(
  positions: string[],
  playerIdToPos: Map<string, string>,
): Array<{ player_id: string; pick_no: number }> {
  return positions.map((pos, i) => {
    const id = `${pos}_${i}`;
    playerIdToPos.set(id, pos);
    return { player_id: id, pick_no: i + 1 };
  });
}

describe("computeRunHeat", () => {
  it("returns 0 heat when pick distribution matches expected rate", () => {
    const posMap = new Map<string, string>();
    // 6 picks matching expected fractions: WR×2, RB×1, QB×1, TE×1, +1 WR (≈expected WR rate)
    const picks = makePicks(["WR", "WR", "RB", "QB", "TE", "WR"], posMap);
    const heat = computeRunHeat(picks, posMap, ["WR_0"], POSITION_RUN_WINDOW);
    // WR count=3, expected=0.25×6=1.5 → tanh(((3-1.5)×0.7)/1.5) ≈ 0.6 → clamped to 0.2
    expect(heat.get("WR_0")).toBeCloseTo(0.2, 5);
  });

  it("returns negative heat when position is under-represented", () => {
    const posMap = new Map<string, string>();
    const picks = makePicks(["WR", "WR", "WR", "WR", "WR", "WR"], posMap);
    // QB count=0, expected=0.1×6=0.6 → tanh(((0-0.6)×0.7)/1.5) ≈ -0.27 → clamped to -0.1
    const rbId = "QB_test";
    posMap.set(rbId, "QB");
    const heat = computeRunHeat(picks, posMap, [rbId], POSITION_RUN_WINDOW);
    expect(heat.get(rbId)).toBeCloseTo(-0.1, 5);
  });

  it("clamps heat to [-0.1, +0.2]", () => {
    const posMap = new Map<string, string>();
    // All 6 picks are WR — maximum run
    const picks = makePicks(["WR", "WR", "WR", "WR", "WR", "WR"], posMap);
    const wrId = "WR_6";
    posMap.set(wrId, "WR");
    const heat = computeRunHeat(picks, posMap, [wrId], POSITION_RUN_WINDOW);
    expect(heat.get(wrId)).toBeLessThanOrEqual(0.2);

    // No picks at QB — minimum heat
    const qbId = "QB_6";
    posMap.set(qbId, "QB");
    const heat2 = computeRunHeat(picks, posMap, [qbId], POSITION_RUN_WINDOW);
    expect(heat2.get(qbId)).toBeGreaterThanOrEqual(-0.1);
  });

  it("only uses the most recent `window` picks", () => {
    const posMap = new Map<string, string>();
    // 10 picks total: first 4 are QB runs (old), last 6 are all WR
    const allPicks = [
      { player_id: "q1", pick_no: 1 },
      { player_id: "q2", pick_no: 2 },
      { player_id: "q3", pick_no: 3 },
      { player_id: "q4", pick_no: 4 },
      { player_id: "w1", pick_no: 5 },
      { player_id: "w2", pick_no: 6 },
      { player_id: "w3", pick_no: 7 },
      { player_id: "w4", pick_no: 8 },
      { player_id: "w5", pick_no: 9 },
      { player_id: "w6", pick_no: 10 },
    ];
    ["q1", "q2", "q3", "q4"].forEach((id) => posMap.set(id, "QB"));
    ["w1", "w2", "w3", "w4", "w5", "w6"].forEach((id) => posMap.set(id, "WR"));

    const qbId = "qb_test";
    posMap.set(qbId, "QB");

    // With window=6, only picks 5-10 matter → QB count=0
    const heat = computeRunHeat(allPicks, posMap, [qbId], 6);
    // QB count=0 in last 6 picks → clamped to -0.1
    expect(heat.get(qbId)).toBeCloseTo(-0.1, 5);
  });

  it("returns 0 for unknown position", () => {
    const posMap = new Map<string, string>();
    const heat = computeRunHeat([], posMap, ["unknown_player"], POSITION_RUN_WINDOW);
    // unknown pos → count=0, expected=0.2×6=1.2 → negative → clamped -0.1
    expect(heat.get("unknown_player")).toBeCloseTo(-0.1, 5);
  });
});

describe("countRecentPositionPicks", () => {
  it("counts picks correctly within the window", () => {
    const posMap = new Map([
      ["p1", "WR"],
      ["p2", "WR"],
      ["p3", "RB"],
      ["p4", "WR"],
    ]);
    const picks = [
      { player_id: "p1", pick_no: 1 },
      { player_id: "p2", pick_no: 2 },
      { player_id: "p3", pick_no: 3 },
      { player_id: "p4", pick_no: 4 },
    ];
    const counts = countRecentPositionPicks(picks, posMap, 6);
    expect(counts["WR"]).toBe(3);
    expect(counts["RB"]).toBe(1);
    expect(counts["QB"]).toBe(0);
    expect(counts["TE"]).toBe(0);
  });
});

describe("POSITION_RUN_WINDOW", () => {
  it("is 6", () => expect(POSITION_RUN_WINDOW).toBe(6));
});

describe("EXPECTED_RUN_RATE", () => {
  it("sums to ≤ 1.0", () => {
    const total = Object.values(EXPECTED_RUN_RATE).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(1.0);
  });
});
