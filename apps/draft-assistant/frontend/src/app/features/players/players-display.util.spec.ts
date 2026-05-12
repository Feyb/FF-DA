/// <reference types="jasmine" />

import {
  filterAndSortPlayerRows,
  PlayerRow,
  PositionFilter,
  SortBy,
  SortDirection,
  ValueSource,
} from "./players-display.util";

function buildRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    playerId: "p1",
    fullName: "Player One",
    position: "QB",
    team: "KC",
    age: 25,
    rookie: false,
    ktcValue: 1000,
    averageRank: 12,
    ktcRank: 10,
    overallTier: 2,
    positionalTier: 1,
    flockAverageTier: 3,
    flockAveragePositionalTier: 2,
    sleeperRank: 20,
    ...overrides,
  };
}

function run(
  rows: PlayerRow[],
  selectedPositions: PositionFilter[] = ["QB", "RB", "WR", "TE"],
  rookiesOnly = false,
  freeAgentsOnly = false,
  assignedPlayerIds: string[] = [],
  sortBy: SortBy = "default",
  sortDirection: SortDirection = "asc",
  valueSource: ValueSource = "ktcValue",
  searchQuery = "",
): PlayerRow[] {
  return filterAndSortPlayerRows(
    rows,
    selectedPositions,
    rookiesOnly,
    freeAgentsOnly,
    assignedPlayerIds,
    sortBy,
    sortDirection,
    valueSource,
    searchQuery,
  );
}

describe("players-display.util", () => {
  it("filters by selected positions and rookiesOnly", () => {
    const rows = [
      buildRow({ playerId: "qb-rookie", position: "QB", rookie: true }),
      buildRow({ playerId: "qb-vet", position: "QB", rookie: false }),
      buildRow({ playerId: "rb-rookie", position: "RB", rookie: true }),
    ];

    const displayed = run(rows, ["QB"], true);
    expect(displayed.map((row) => row.playerId)).toEqual(["qb-rookie"]);
  });

  it("default sort uses ktc rank then sleeper rank tiebreak", () => {
    const rows = [
      buildRow({ playerId: "a", ktcRank: 5, sleeperRank: 20 }),
      buildRow({ playerId: "b", ktcRank: 5, sleeperRank: 10 }),
      buildRow({ playerId: "c", ktcRank: 2, sleeperRank: 99 }),
    ];

    const displayed = run(rows);
    expect(displayed.map((row) => row.playerId)).toEqual(["c", "b", "a"]);
  });

  it("default sort with averageRank source falls back to ktcRank when averageRank is null", () => {
    const rows = [
      buildRow({ playerId: "avg", averageRank: 3, ktcRank: 99 }),
      buildRow({ playerId: "fallback", averageRank: null, ktcRank: 4 }),
    ];

    const displayed = run(rows, ["QB", "RB", "WR", "TE"], false, false, [], "default", "asc", "averageRank");
    expect(displayed.map((row) => row.playerId)).toEqual(["avg", "fallback"]);
  });

  it("sorts by team and keeps null teams last for ascending", () => {
    const rows = [
      buildRow({ playerId: "null-team", team: null }),
      buildRow({ playerId: "atl", team: "ATL" }),
      buildRow({ playerId: "chi", team: "CHI" }),
    ];

    const displayed = run(rows, ["QB", "RB", "WR", "TE"], false, false, [], "team", "asc", "ktcValue");
    expect(displayed.map((row) => row.playerId)).toEqual(["atl", "chi", "null-team"]);
  });

  it("sorts by value source field for ktcValue sort", () => {
    const rows = [
      buildRow({ playerId: "high", ktcValue: 9000 }),
      buildRow({ playerId: "low", ktcValue: 1000 }),
    ];

    const displayed = run(rows, ["QB", "RB", "WR", "TE"], false, false, [], "ktcValue", "desc", "ktcValue");
    expect(displayed.map((row) => row.playerId)).toEqual(["high", "low"]);
  });

  it("hides rostered players when freeAgentsOnly is true", () => {
    const rows = [
      buildRow({ playerId: "rostered", fullName: "Rostered Player" }),
      buildRow({ playerId: "free", fullName: "Free Agent" }),
    ];

    const displayed = run(rows, ["QB", "RB", "WR", "TE"], false, true, ["rostered"]);
    expect(displayed.map((row) => row.playerId)).toEqual(["free"]);
  });

  it("shows all players when freeAgentsOnly is false regardless of assignedPlayerIds", () => {
    const rows = [
      buildRow({ playerId: "rostered" }),
      buildRow({ playerId: "free" }),
    ];

    const displayed = run(rows, ["QB", "RB", "WR", "TE"], false, false, ["rostered"]);
    expect(displayed.map((row) => row.playerId)).toEqual(["rostered", "free"]);
  });
});
