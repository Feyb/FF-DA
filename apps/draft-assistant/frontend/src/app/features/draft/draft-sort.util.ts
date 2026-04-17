import { DraftPlayerRow } from '../../core/models';

export type DraftSortSource =
  | 'combinedTier'
  | 'sleeperRank'
  | 'ktcRank'
  | 'flockRank'
  | 'combinedPositionalTier'
  | 'adpDelta'
  | 'valueGap'
  | 'fpAdpRank';

/** Sort comparator keyed on DraftSortSource. Lower return = higher priority. */
export function sortBySortSource(a: DraftPlayerRow, b: DraftPlayerRow, src: DraftSortSource): number {
  switch (src) {
    case 'combinedTier': {
      const aTier = a.combinedTier ?? Number.MAX_SAFE_INTEGER;
      const bTier = b.combinedTier ?? Number.MAX_SAFE_INTEGER;
      if (aTier !== bTier) return aTier - bTier;
      break;
    }
    case 'sleeperRank':
      if (a.sleeperRank !== b.sleeperRank) return a.sleeperRank - b.sleeperRank;
      break;
    case 'ktcRank': {
      const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      break;
    }
    case 'flockRank': {
      const aRank = a.averageRank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.averageRank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      break;
    }
    case 'combinedPositionalTier': {
      const aTier = a.combinedPositionalTier ?? Number.MAX_SAFE_INTEGER;
      const bTier = b.combinedPositionalTier ?? Number.MAX_SAFE_INTEGER;
      if (aTier !== bTier) return aTier - bTier;
      break;
    }
    case 'adpDelta': {
      // Descending: biggest positive delta (best value) first. Nulls last.
      const aDelta = a.adpDelta ?? -Number.MAX_SAFE_INTEGER;
      const bDelta = b.adpDelta ?? -Number.MAX_SAFE_INTEGER;
      if (aDelta !== bDelta) return bDelta - aDelta;
      break;
    }
    case 'valueGap': {
      // Descending: highest disagreement first. Nulls last.
      const aGap = a.valueGap ?? -1;
      const bGap = b.valueGap ?? -1;
      if (aGap !== bGap) return bGap - aGap;
      break;
    }
    case 'fpAdpRank': {
      const aRank = a.fpAdpRank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.fpAdpRank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      break;
    }
  }

  // Tiebreak: sleeperRank
  return a.sleeperRank - b.sleeperRank;
}

/** Return the numeric rank value for a row based on the active sort source. */
export function rankForSortSource(row: DraftPlayerRow, src: DraftSortSource): number | null {
  switch (src) {
    case 'combinedTier': return row.combinedTier;
    case 'sleeperRank': return row.sleeperRank;
    case 'ktcRank': return row.ktcRank;
    case 'flockRank': return row.averageRank;
    case 'combinedPositionalTier': return row.combinedPositionalTier;
    case 'adpDelta': return row.adpDelta;
    case 'valueGap': return row.valueGap;
    case 'fpAdpRank': return row.fpAdpRank;
  }
}

/** Return the positional-rank/tier value for a row based on the active sort source. */
export function positionalRankForSortSource(row: DraftPlayerRow, src: DraftSortSource): number | null {
  switch (src) {
    case 'combinedTier': return row.combinedPositionalTier;
    case 'sleeperRank': return null; // Sleeper does not expose a separate positional rank
    case 'ktcRank': return row.positionalTier;
    case 'flockRank': return row.flockAveragePositionalTier;
    case 'combinedPositionalTier': return row.combinedPositionalTier;
    case 'adpDelta': return null;
    case 'valueGap': return null;
    case 'fpAdpRank': return null;
  }
}
