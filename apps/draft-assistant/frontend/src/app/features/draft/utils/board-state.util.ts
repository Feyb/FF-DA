/**
 * Board-state utilities — signals derived from live draft picks
 * that reflect market dynamics and position-run pressure.
 *
 * RunHeat: soft signal measuring whether a position run is actively
 * happening in the trailing pick window.
 * Formula: tanh(((count − expected) × 0.7) / 1.5), clamped to [−0.1, +0.2].
 */

export const POSITION_RUN_WINDOW = 6;

export const EXPECTED_RUN_RATE: Readonly<Record<string, number>> = {
  WR: 0.25,
  RB: 0.2,
  QB: 0.1,
  TE: 0.1,
};

export interface RecentPick {
  player_id: string;
  pick_no: number;
}

/**
 * Compute per-player RunHeat values.
 *
 * @param recentPicks   Most-recent N picks from the draft (unsorted; function sorts internally).
 * @param playerIdToPos Map from Sleeper player_id → position string.
 * @param allPlayerIds  All undrafted player IDs to populate in the output map.
 * @param window        Trailing pick window size (default POSITION_RUN_WINDOW).
 * @returns Map<playerId, runHeat> where runHeat ∈ [−0.1, +0.2].
 */
export function computeRunHeat(
  recentPicks: RecentPick[],
  playerIdToPos: Map<string, string>,
  allPlayerIds: string[],
  window = POSITION_RUN_WINDOW,
): Map<string, number> {
  const recent = recentPicks
    .slice()
    .sort((a, b) => b.pick_no - a.pick_no)
    .slice(0, window);

  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const pick of recent) {
    const pos = playerIdToPos.get(pick.player_id);
    if (typeof pos === "string" && pos in counts) counts[pos]++;
  }

  const out = new Map<string, number>();
  for (const playerId of allPlayerIds) {
    const pos = playerIdToPos.get(playerId) ?? "";
    const count = counts[pos] ?? 0;
    const expected = (EXPECTED_RUN_RATE[pos] ?? 0.2) * window;
    const heat = Math.tanh(((count - expected) * 0.7) / 1.5);
    out.set(playerId, Math.max(-0.1, Math.min(0.2, heat)));
  }
  return out;
}

/**
 * Count how many of the last `window` picks were at each position.
 * Used by the explanation engine to avoid re-deriving from the heat map.
 */
export function countRecentPositionPicks(
  recentPicks: RecentPick[],
  playerIdToPos: Map<string, string>,
  window = POSITION_RUN_WINDOW,
): Record<string, number> {
  const recent = recentPicks
    .slice()
    .sort((a, b) => b.pick_no - a.pick_no)
    .slice(0, window);

  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const pick of recent) {
    const pos = playerIdToPos.get(pick.player_id);
    if (typeof pos === "string" && pos in counts) counts[pos]++;
  }
  return counts;
}
