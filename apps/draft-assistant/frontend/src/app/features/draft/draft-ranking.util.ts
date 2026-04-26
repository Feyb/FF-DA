import { DraftPlayerRow, TierSource } from "../../core/models";
import { resolveTier as resolveTierUtil } from "../../core/utils/tier-resolution.util";

export type DraftValueSource = "ktcValue" | "averageRank";

export function resolveDraftTier(row: DraftPlayerRow, tierSrc: TierSource): number {
  const ktcTier = row.positionalTier ?? row.overallTier ?? null;
  // Fall back to rookie Flock tier for prospects not present in veteran Flock rankings.
  const flockTier =
    row.flockAveragePositionalTier ?? row.flockAverageTier ?? row.flockRookieTier ?? null;

  if (tierSrc === "flock" && flockTier === null) {
    return ktcTier ?? Number.MAX_SAFE_INTEGER;
  }

  return resolveTierUtil(ktcTier, flockTier, tierSrc) ?? Number.MAX_SAFE_INTEGER;
}

export function resolveDraftValue(row: DraftPlayerRow, valueSrc: DraftValueSource): number {
  if (valueSrc === "ktcValue") return row.ktcValue ?? 0;

  // averageRank is lower-is-better; negate so higher return value = better player.
  // Fall back to rookie rank for prospects not in veteran Flock, then ktcValue.
  if (row.averageRank !== null) return -row.averageRank;
  if (row.flockRookieRank !== null) return -row.flockRookieRank;
  return row.ktcValue ?? 0;
}
