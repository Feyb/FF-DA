/// <reference types="jasmine" />

import { buildCfbdMetricsByName, normalizeCfbdName } from "./cfbd.service";

describe("cfbd.service helpers", () => {
  it("normalizes names consistently across suffixes and punctuation", () => {
    expect(normalizeCfbdName("Marvin Harrison Jr.")).toBe("marvinharrison");
    expect(normalizeCfbdName("D.J. Uiagalelei")).toBe("djuiagalelei");
  });

  it("prefers records with more available metrics for the same normalized name", () => {
    const map = buildCfbdMetricsByName([
      {
        player_name: "Player One",
        season: 2025,
        position: "WR",
        ras: 6.2,
        dominator_rating: null,
        breakout_age: null,
        yptpa: null,
      },
      {
        player_name: "Player One Jr.",
        season: 2024,
        position: "WR",
        ras: 7.5,
        dominator_rating: 0.31,
        breakout_age: 19.2,
        yptpa: 1.8,
      },
    ]);

    expect(map.get("playerone")).toEqual({
      dominatorRating: 0.31,
      breakoutAge: 19.2,
      yptpa: 1.8,
      ras: 7.5,
    });
  });

  it("uses newer season when metric completeness is tied", () => {
    const map = buildCfbdMetricsByName([
      {
        player_name: "Player Two",
        season: 2023,
        position: "RB",
        ras: 5.1,
        dominator_rating: 0.22,
        breakout_age: null,
        yptpa: null,
      },
      {
        player_name: "Player Two",
        season: 2025,
        position: "RB",
        ras: 8.3,
        dominator_rating: 0.28,
        breakout_age: null,
        yptpa: null,
      },
    ]);

    expect(map.get("playertwo")).toEqual({
      dominatorRating: 0.28,
      breakoutAge: null,
      yptpa: null,
      ras: 8.3,
    });
  });
});
