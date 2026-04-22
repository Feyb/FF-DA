/**
 * VNP — Value over Next Pick (dynamic VONA).
 *
 * Estimates the expected projection of the best player available at a given
 * position at the user's next pick, using ADP survival probability to filter
 * the pool. The result is positive when the current player is better than what
 * will likely remain at the position.
 *
 * Formula (spec §4d):
 *   VNP(i) = (Proj(i) − E[Proj at pos(i) at nextPick]) / scale
 *
 * E[Proj at pos, at nextPick] is approximated as the projection of the
 * best-surviving player (by ADP), where survival = Φ((nextPick - μ_j)/σ_j) < 0.5.
 *
 * The signal fires a "big VONA drop" explanation when VNP > 0.3·σ_pos AND
 * pAvailAtNext < 0.4.
 */

export interface VnpPlayer {
  playerId: string;
  position: string;
  /** Normalized projection proxy (baseValue 0-100 works; real projection in redraft). */
  projection: number | null;
  adpMean: number | null;
  adpStd: number | null;
}

/**
 * Compute VNP for each player.
 *
 * @param players       - All undrafted players.
 * @param nextPickN     - The user's next pick number.
 * @param pAvailFn      - Function to compute P(available at pick N) given adpMean/adpStd.
 * @param scale         - Divisor to normalize the VNP to ~[-1, +1] range (default 20).
 * @returns Map<playerId, vnp>
 */
export function computeVnp(
  players: VnpPlayer[],
  nextPickN: number,
  pAvailFn: (pickN: number, adpMean: number, adpStd: number) => number,
  scale = 20,
): Map<string, number> {
  // For each position, compute the expected best projection at nextPickN.
  // "Expected best" = projection of the highest-baseValue player whose
  // P(available at nextPickN) ≥ 0.5.
  const bestAtPos = new Map<string, number | null>();
  const positions = [...new Set(players.map((p) => p.position))];

  for (const pos of positions) {
    const pool = players.filter(
      (p) =>
        p.position === pos &&
        p.projection !== null &&
        p.adpMean !== null,
    );

    // Sort by projection descending.
    pool.sort((a, b) => (b.projection ?? 0) - (a.projection ?? 0));

    // Walk pool in projection order; find first with pAvail ≥ 0.5.
    let bestProj: number | null = null;
    for (const p of pool) {
      const mean = p.adpMean!;
      const std = p.adpStd ?? Math.max(1.5, mean / 8);
      const pAvail = pAvailFn(nextPickN, mean, std);
      if (pAvail >= 0.5) {
        bestProj = p.projection;
        break;
      }
    }
    bestAtPos.set(pos, bestProj);
  }

  const out = new Map<string, number>();
  for (const p of players) {
    if (p.projection === null) continue;
    const best = bestAtPos.get(p.position) ?? null;
    if (best === null) {
      out.set(p.playerId, 0);
      continue;
    }
    out.set(p.playerId, (p.projection - best) / scale);
  }
  return out;
}
