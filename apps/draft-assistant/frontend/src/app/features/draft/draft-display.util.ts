import { DraftSortSource } from "./draft-sort.util";

export function sortSourceRankLabel(source: DraftSortSource): string {
  switch (source) {
    case "combinedTier":
      return "Comb. Tier";
    case "sleeperRank":
      return "Sleeper Rank";
    case "ktcRank":
      return "KTC Rank";
    case "flockRank":
      return "Flock Rank";
    case "combinedPositionalTier":
      return "Comb. Pos. Tier";
    case "adpDelta":
      return "ADP Delta";
    case "valueGap":
      return "Value Gap";
    case "fpAdpRank":
      return "FP ADP";
    case "weightedComposite":
      return "WCS";
  }
}

/** Short label (≤5 chars) shown as a prefix inside the rank badge on PlayerCardComponent. */
export function sortSourceShortLabel(source: DraftSortSource): string {
  switch (source) {
    case "combinedTier":
      return "CT";
    case "sleeperRank":
      return "Slpr";
    case "ktcRank":
      return "KTC";
    case "flockRank":
      return "Flock";
    case "combinedPositionalTier":
      return "CPT";
    case "adpDelta":
      return "ΔADP";
    case "valueGap":
      return "Gap";
    case "fpAdpRank":
      return "FP";
    case "weightedComposite":
      return "WCS";
  }
}

export function adpDeltaLabel(delta: number | null): string {
  if (delta === null) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function adpDeltaClass(delta: number | null): string {
  if (delta === null) return "";
  if (delta > 1) return "adp-value";
  if (delta < -1) return "adp-reach";
  return "adp-neutral";
}

/**
 * Maps an EffScore z-score to a letter grade.
 * Returns null when the score is null (< 6 games of data).
 * Thresholds: A+ ≥ 1.5 · A ≥ 0.75 · B ≥ 0 · C ≥ −0.75 · D < −0.75
 */
export function effGradeFromScore(score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;
  if (score >= 1.5) return "A+";
  if (score >= 0.75) return "A";
  if (score >= 0) return "B";
  if (score >= -0.75) return "C";
  return "D";
}

/** CSS modifier class for a letter-grade Eff pill. */
export function effGradePillClass(grade: string | null): string {
  if (!grade) return "";
  if (grade === "A+" || grade === "A") return "eff-high";
  if (grade === "B") return "eff-mid";
  if (grade === "C") return "eff-neutral";
  return "eff-low";
}
