import { computeRookieScore, buildRookieScoreMap, RookieScoreInputs } from "./rookie-score.util";

const HIGH_CFBD = { dominatorRating: 0.38, breakoutAge: 18, yptpa: 2.1, ras: 9.2 };
const AVG_CFBD = { dominatorRating: 0.21, breakoutAge: 19.5, yptpa: 1.4, ras: 5.8 };
const LOW_CFBD = { dominatorRating: 0.08, breakoutAge: 21.0, yptpa: 0.7, ras: 3.0 };

describe("computeRookieScore", () => {
  it("returns null for veterans (yearsExp > 2)", () => {
    const input: RookieScoreInputs = {
      playerId: "v1",
      position: "WR",
      nflRound: 1,
      yearsExp: 3,
      cfbd: HIGH_CFBD,
    };
    expect(computeRookieScore(input)).toBeNull();
  });

  it("returns null for unknown position", () => {
    const input: RookieScoreInputs = {
      playerId: "p1",
      position: "K",
      nflRound: 1,
      yearsExp: 0,
      cfbd: HIGH_CFBD,
    };
    expect(computeRookieScore(input)).toBeNull();
  });

  it("high-capital, elite-CFBD WR scores well above average", () => {
    const high: RookieScoreInputs = {
      playerId: "h",
      position: "WR",
      nflRound: 1,
      yearsExp: 0,
      cfbd: HIGH_CFBD,
    };
    const avg: RookieScoreInputs = {
      playerId: "a",
      position: "WR",
      nflRound: 3,
      yearsExp: 0,
      cfbd: AVG_CFBD,
    };
    const low: RookieScoreInputs = {
      playerId: "l",
      position: "WR",
      nflRound: 6,
      yearsExp: 0,
      cfbd: LOW_CFBD,
    };

    const scoreHigh = computeRookieScore(high)!;
    const scoreAvg = computeRookieScore(avg)!;
    const scoreLow = computeRookieScore(low)!;

    expect(scoreHigh).toBeGreaterThan(scoreAvg);
    expect(scoreAvg).toBeGreaterThan(scoreLow);
  });

  it("capital-only (null CFBD) returns non-null for R1 rookie", () => {
    const input: RookieScoreInputs = {
      playerId: "p",
      position: "RB",
      nflRound: 1,
      yearsExp: 0,
      cfbd: null,
    };
    const score = computeRookieScore(input);
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThan(0);
  });

  it("returns null when no capital and no CFBD data", () => {
    const input: RookieScoreInputs = {
      playerId: "p",
      position: "WR",
      nflRound: null,
      yearsExp: 0,
      cfbd: null,
    };
    expect(computeRookieScore(input)).toBeNull();
  });

  describe("position ordering — R1 pick with elite CFBD", () => {
    const positions = ["WR", "RB", "TE", "QB"] as const;
    for (const pos of positions) {
      it(`returns a number for ${pos}`, () => {
        const input: RookieScoreInputs = {
          playerId: "p",
          position: pos,
          nflRound: 1,
          yearsExp: 0,
          cfbd: HIGH_CFBD,
        };
        expect(typeof computeRookieScore(input)).toBe("number");
      });
    }
  });

  it("UDFA (round 8) scores lower than R1 when CFBD is equal", () => {
    const r1: RookieScoreInputs = {
      playerId: "r1",
      position: "WR",
      nflRound: 1,
      yearsExp: 0,
      cfbd: AVG_CFBD,
    };
    const udfa: RookieScoreInputs = {
      playerId: "udfa",
      position: "WR",
      nflRound: 8,
      yearsExp: 0,
      cfbd: AVG_CFBD,
    };
    expect(computeRookieScore(r1)!).toBeGreaterThan(computeRookieScore(udfa)!);
  });

  it("year-2 player (yearsExp=1) still gets a score", () => {
    const input: RookieScoreInputs = {
      playerId: "y2",
      position: "TE",
      nflRound: 2,
      yearsExp: 1,
      cfbd: AVG_CFBD,
    };
    expect(computeRookieScore(input)).not.toBeNull();
  });
});

describe("buildRookieScoreMap", () => {
  it("omits veterans from the output map", () => {
    const inputs: RookieScoreInputs[] = [
      { playerId: "rookie", position: "WR", nflRound: 1, yearsExp: 0, cfbd: AVG_CFBD },
      { playerId: "vet", position: "WR", nflRound: 1, yearsExp: 4, cfbd: null },
    ];
    const map = buildRookieScoreMap(inputs);
    expect(map.has("rookie")).toBe(true);
    expect(map.has("vet")).toBe(false);
  });

  it("returns a map entry for each eligible player", () => {
    const inputs: RookieScoreInputs[] = [
      { playerId: "a", position: "WR", nflRound: 1, yearsExp: 0, cfbd: HIGH_CFBD },
      { playerId: "b", position: "RB", nflRound: 3, yearsExp: 1, cfbd: LOW_CFBD },
    ];
    const map = buildRookieScoreMap(inputs);
    expect(map.size).toBe(2);
  });
});
