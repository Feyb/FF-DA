/**
 * NFL draft round → fantasy hit-rate multiplier for rookies (yearsExp ≤ 2).
 *
 * Anchors:
 *   WR: FantasyPros R1 25% top-24 hit rate vs. 7% R3 (2019-2025)
 *   RB: Razzball/Peter Howard R1 67% vs. R3 18%
 *   TE: FantasyLife — 100% of rookie top-12 TEs came from R1-R2 since 2015
 *   QB: Multiplier is strongest because non-Day-1 QBs rarely start early
 *
 * Applied only when yearsExp ≤ 2; returns 1.0 for veterans.
 * Multiplier range clamped to [0.70, 1.30].
 */

export type NflPosition = "QB" | "RB" | "WR" | "TE";

/** Draft round; 8 = UDFA / undrafted free agent. */
export type NflDraftRound = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const NFL_CAPITAL_MULT: Record<NflPosition, Record<NflDraftRound, number>> = {
  WR: { 1: 1.25, 2: 1.15, 3: 0.95, 4: 0.85, 5: 0.75, 6: 0.72, 7: 0.7, 8: 0.7 },
  RB: { 1: 1.25, 2: 1.12, 3: 0.9, 4: 0.75, 5: 0.75, 6: 0.72, 7: 0.7, 8: 0.7 },
  TE: { 1: 1.25, 2: 1.1, 3: 0.85, 4: 0.78, 5: 0.72, 6: 0.7, 7: 0.7, 8: 0.7 },
  QB: { 1: 1.3, 2: 1.0, 3: 0.8, 4: 0.72, 5: 0.7, 6: 0.7, 7: 0.7, 8: 0.7 },
};

/**
 * Returns the capital multiplier for a player.
 *   - Veterans (yearsExp > 2) → 1.0 (capital no longer predictive)
 *   - Unknown position or round → 1.0
 */
export function getCapitalMult(
  position: string,
  nflRound: number | null,
  yearsExp: number | null,
): number {
  if (yearsExp !== null && yearsExp > 2) return 1.0;
  if (nflRound === null) return 1.0;

  const table = NFL_CAPITAL_MULT[position as NflPosition];
  if (!table) return 1.0;

  const round = Math.min(8, Math.max(1, Math.round(nflRound))) as NflDraftRound;
  return table[round] ?? 1.0;
}
