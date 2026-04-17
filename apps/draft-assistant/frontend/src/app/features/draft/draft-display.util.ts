import { DraftSortSource } from './draft-sort.util';

export function sortSourceRankLabel(source: DraftSortSource): string {
  switch (source) {
    case 'combinedTier': return 'Comb. Tier';
    case 'sleeperRank': return 'Sleeper Rank';
    case 'ktcRank': return 'KTC Rank';
    case 'flockRank': return 'Flock Rank';
    case 'combinedPositionalTier': return 'Comb. Pos. Tier';
    case 'adpDelta': return 'ADP Delta';
    case 'valueGap': return 'Value Gap';
    case 'fpAdpRank': return 'FP ADP';
  }
}

export function adpDeltaLabel(delta: number | null): string {
  if (delta === null) return '—';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function adpDeltaClass(delta: number | null): string {
  if (delta === null) return '';
  if (delta > 1) return 'adp-value';
  if (delta < -1) return 'adp-reach';
  return 'adp-neutral';
}
