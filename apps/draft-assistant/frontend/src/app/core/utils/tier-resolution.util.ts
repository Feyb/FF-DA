import { TierSource } from "../models";

export function resolveTier(
  ktcTier: number | null,
  flockTier: number | null,
  source: TierSource,
): number | null {
  if (source === "ktc") return ktcTier;
  if (source === "flock") return flockTier ?? ktcTier;
  if (flockTier === null) return ktcTier;
  if (ktcTier === null) return flockTier;
  return Math.round((ktcTier + flockTier) / 2);
}
