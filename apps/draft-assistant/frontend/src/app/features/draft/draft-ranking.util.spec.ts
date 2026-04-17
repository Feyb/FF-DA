/// <reference types="jasmine" />

import { DraftPlayerRow } from '../../core/models';
import { resolveDraftTier, resolveDraftValue } from './draft-ranking.util';

function buildRow(overrides: Partial<DraftPlayerRow> = {}): DraftPlayerRow {
  return {
    playerId: 'p1',
    fullName: 'Player One',
    position: 'QB',
    team: 'KC',
    age: 25,
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
    sleeperRank: 20,
    combinedTier: 3,
    combinedPositionalTier: 2,
    adpRank: 15,
    adpDelta: 1,
    valueGap: 1,
    fpAdpRank: 18,
    ...overrides,
  };
}

describe('draft-ranking.util', () => {
  describe('resolveDraftTier', () => {
    it('uses flock fallback to KTC tier when flock tier is unavailable', () => {
      const row = buildRow({ positionalTier: 4, overallTier: 8, flockAveragePositionalTier: null, flockAverageTier: null });
      expect(resolveDraftTier(row, 'flock')).toBe(4);
    });

    it('returns MAX_SAFE_INTEGER when no tier data is available', () => {
      const row = buildRow({ positionalTier: null, overallTier: null, flockAveragePositionalTier: null, flockAverageTier: null });
      expect(resolveDraftTier(row, 'flock')).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('averages KTC and flock tiers in average mode', () => {
      const row = buildRow({ positionalTier: 2, flockAveragePositionalTier: 4 });
      expect(resolveDraftTier(row, 'average')).toBe(3);
    });
  });

  describe('resolveDraftValue', () => {
    it('uses ktcValue directly for ktcValue source', () => {
      const row = buildRow({ ktcValue: 2500 });
      expect(resolveDraftValue(row, 'ktcValue')).toBe(2500);
    });

    it('negates averageRank for averageRank source', () => {
      const row = buildRow({ averageRank: 12, ktcValue: 2500 });
      expect(resolveDraftValue(row, 'averageRank')).toBe(-12);
    });

    it('falls back to ktcValue when averageRank is unavailable', () => {
      const row = buildRow({ averageRank: null, ktcValue: 2500 });
      expect(resolveDraftValue(row, 'averageRank')).toBe(2500);
    });
  });
});
