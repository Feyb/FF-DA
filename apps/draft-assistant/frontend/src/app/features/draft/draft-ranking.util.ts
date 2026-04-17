import { DraftPlayerRow, TierSource } from '../../core/models';
import { resolveTier as resolveTierUtil } from '../../core/utils/tier-resolution.util';

export type DraftValueSource = 'ktcValue' | 'averageRank';

export function resolveDraftTier(row: DraftPlayerRow, tierSrc: TierSource): number {
  const ktcTier = row.positionalTier ?? row.overallTier ?? null;
  const flockTier = row.flockAveragePositionalTier ?? row.flockAverageTier ?? null;

  if (tierSrc === 'flock' && flockTier === null) {
    return ktcTier ?? Number.MAX_SAFE_INTEGER;
  }

  return resolveTierUtil(ktcTier, flockTier, tierSrc) ?? Number.MAX_SAFE_INTEGER;
}

export function resolveDraftValue(row: DraftPlayerRow, valueSrc: DraftValueSource): number {
  if (valueSrc === 'ktcValue') return row.ktcValue ?? 0;

  // averageRank is lower-is-better; negate so higher return value = better player.
  // Fall back to ktcValue when averageRank is unavailable.
  if (row.averageRank !== null) return -row.averageRank;
  return row.ktcValue ?? 0;
}
