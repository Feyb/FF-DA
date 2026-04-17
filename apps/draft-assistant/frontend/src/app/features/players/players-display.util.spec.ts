/// <reference types="jasmine" />

import {
  filterAndSortPlayerRows,
  PlayerRow,
  PositionFilter,
  SortBy,
  SortDirection,
  ValueSource,
} from './players-display.util';

function buildRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    playerId: 'p1',
    fullName: 'Player One',
    position: 'QB',
    team: 'KC',
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
  selectedPositions: PositionFilter[] = ['QB', 'RB', 'WR', 'TE'],
  rookiesOnly = false,
  sortBy: SortBy = 'default',
  sortDirection: SortDirection = 'asc',
  valueSource: ValueSource = 'ktcValue',
): PlayerRow[] {
  return filterAndSortPlayerRows(rows, selectedPositions, rookiesOnly, sortBy, sortDirection, valueSource);
}

describe('players-display.util', () => {
  it('filters by selected positions and rookiesOnly', () => {
    const rows = [
      buildRow({ playerId: 'qb-rookie', position: 'QB', rookie: true }),
      buildRow({ playerId: 'qb-vet', position: 'QB', rookie: false }),
      buildRow({ playerId: 'rb-rookie', position: 'RB', rookie: true }),
    ];

    const displayed = run(rows, ['QB'], true);
    expect(displayed.map((row) => row.playerId)).toEqual(['qb-rookie']);
  });

  it('default sort uses ktc rank then sleeper rank tiebreak', () => {
    const rows = [
      buildRow({ playerId: 'a', ktcRank: 5, sleeperRank: 20 }),
      buildRow({ playerId: 'b', ktcRank: 5, sleeperRank: 10 }),
      buildRow({ playerId: 'c', ktcRank: 2, sleeperRank: 99 }),
    ];

    const displayed = run(rows);
    expect(displayed.map((row) => row.playerId)).toEqual(['c', 'b', 'a']);
  });

  it('default sort with averageRank source falls back to ktcRank when averageRank is null', () => {
    const rows = [
      buildRow({ playerId: 'avg', averageRank: 3, ktcRank: 99 }),
      buildRow({ playerId: 'fallback', averageRank: null, ktcRank: 4 }),
    ];

    const displayed = run(rows, ['QB', 'RB', 'WR', 'TE'], false, 'default', 'asc', 'averageRank');
    expect(displayed.map((row) => row.playerId)).toEqual(['avg', 'fallback']);
  });

  it('sorts by team and keeps null teams last for ascending', () => {
    const rows = [
      buildRow({ playerId: 'null-team', team: null }),
      buildRow({ playerId: 'atl', team: 'ATL' }),
      buildRow({ playerId: 'chi', team: 'CHI' }),
    ];

    const displayed = run(rows, ['QB', 'RB', 'WR', 'TE'], false, 'team', 'asc', 'ktcValue');
    expect(displayed.map((row) => row.playerId)).toEqual(['atl', 'chi', 'null-team']);
  });

  it('sorts by value source field for ktcValue sort', () => {
    const rows = [
      buildRow({ playerId: 'high', ktcValue: 9000 }),
      buildRow({ playerId: 'low', ktcValue: 1000 }),
    ];

    const displayed = run(rows, ['QB', 'RB', 'WR', 'TE'], false, 'ktcValue', 'desc', 'ktcValue');
    expect(displayed.map((row) => row.playerId)).toEqual(['high', 'low']);
  });
});
