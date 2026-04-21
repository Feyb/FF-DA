/**
 * Tier-cliff utility — clusters players within a position by baseValue using
 * Jenks natural breaks, then computes an "expected loss of waiting" score:
 *
 *   tierCliffScore(i) = P(all tier-mates of i are taken before next pick)
 *                     * (mean_baseValue_thisTier - mean_baseValue_nextTier)
 *
 * Independence across tier-mate survival is the standard public-tool
 * approximation; correlated survival would require Monte Carlo, deferred to a
 * later phase. The formula intentionally fires before the last player in a
 * tier is picked, so the recommendation surfaces an anticipatory push rather
 * than the existing tier-drop alert that fires after the fact.
 */

export interface TierCliffPlayer {
  playerId: string;
  position: string;
  baseValue: number | null;
  /** Probability the player is still on the board at the user's next pick. */
  pAvailAtNext: number | null;
}

export interface TierAssignment {
  playerId: string;
  /** 1-indexed tier within the player's position; 1 = best. */
  tier: number;
  meanBaseValue: number;
  /** Mean baseValue of the next-worst tier within the same position; null if last. */
  nextTierMeanBaseValue: number | null;
}

export interface TierCliffResult {
  tierByPlayer: Map<string, TierAssignment>;
  tierCliffByPlayer: Map<string, number>;
}

interface TierBucket {
  tier: number;
  members: TierCliffPlayer[];
  mean: number;
}

/**
 * Compute Jenks natural breaks on a sorted ascending array of values.
 * Standard 1-D dynamic programming — O(N^2 K) but K and N stay small per
 * position (max ~50 ranked players, K = 5–8 tiers), so well under 5 ms.
 *
 * Returns the index of each break point in the sorted array, length numClasses-1.
 * Implementation adapted from Jenks (1967) and Slocum's textbook treatment.
 */
function jenksBreaks(sortedAsc: number[], numClasses: number): number[] {
  const n = sortedAsc.length;
  if (numClasses <= 1 || n <= numClasses) return [];

  const lowerClassLimits: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from<number>({ length: numClasses + 1 }).fill(0),
  );
  const variance: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from<number>({ length: numClasses + 1 }).fill(Infinity),
  );

  for (let i = 1; i <= numClasses; i++) {
    lowerClassLimits[1][i] = 1;
    variance[1][i] = 0;
    for (let j = 2; j <= n; j++) variance[j][i] = Infinity;
  }

  for (let l = 2; l <= n; l++) {
    let sum = 0;
    let sumSquares = 0;
    let w = 0;
    for (let m = 1; m <= l; m++) {
      const lowerClassLimit = l - m + 1;
      const value = sortedAsc[lowerClassLimit - 1];
      w += 1;
      sum += value;
      sumSquares += value * value;
      const v = sumSquares - (sum * sum) / w;
      const i4 = lowerClassLimit - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= numClasses; j++) {
          if (variance[l][j] >= v + variance[i4][j - 1]) {
            lowerClassLimits[l][j] = lowerClassLimit;
            variance[l][j] = v + variance[i4][j - 1];
          }
        }
      }
    }
    lowerClassLimits[l][1] = 1;
    variance[l][1] = sumSquares - (sum * sum) / w;
  }

  const breaks: number[] = [];
  let k = n;
  for (let j = numClasses; j >= 2; j--) {
    const idx = lowerClassLimits[k][j] - 1;
    breaks.push(idx);
    k = idx;
  }
  return breaks.reverse();
}

/**
 * Pick a tier count for a position based on roster size.
 * 6 tiers covers most fantasy-relevant pools; small pools get fewer tiers.
 */
function chooseTierCount(n: number): number {
  if (n <= 4) return Math.max(1, n);
  if (n <= 12) return 4;
  if (n <= 30) return 6;
  return 8;
}

export function computeTierCliff(
  players: TierCliffPlayer[],
  options: { tierCount?: (positionSize: number) => number } = {},
): TierCliffResult {
  const tierByPlayer = new Map<string, TierAssignment>();
  const tierCliffByPlayer = new Map<string, number>();

  // Group by position.
  const byPos = new Map<string, TierCliffPlayer[]>();
  for (const p of players) {
    if (p.baseValue === null || !Number.isFinite(p.baseValue)) continue;
    const arr = byPos.get(p.position) ?? [];
    arr.push(p);
    byPos.set(p.position, arr);
  }

  for (const [, posPlayers] of byPos) {
    const sortedDesc = [...posPlayers].sort((a, b) => (b.baseValue ?? 0) - (a.baseValue ?? 0));
    const valuesAsc = sortedDesc.map((p) => p.baseValue as number).sort((a, b) => a - b);

    const tierCount = (options.tierCount ?? chooseTierCount)(sortedDesc.length);
    const breakIdxs = jenksBreaks(valuesAsc, tierCount);

    // breakIdxs are indices in the ascending-sorted array; convert to
    // baseValue thresholds and assign tiers in descending order.
    const ascThresholds = breakIdxs.map((i) => valuesAsc[i]);
    // tier 1 = highest baseValue. Walk sortedDesc and assign by which
    // ascending-threshold band the value falls into (from the top).
    const buckets = new Map<number, TierBucket>();
    for (const p of sortedDesc) {
      const v = p.baseValue as number;
      // ascThresholds has tierCount-1 entries (lower bound of each band
      // above the lowest). Count how many thresholds v meets or exceeds —
      // that is the ascending-band index (0 = lowest band, tierCount-1 = top).
      let matched = 0;
      for (let k = 0; k < ascThresholds.length; k++) {
        if (v >= ascThresholds[k]) matched = k + 1;
        else break;
      }
      // Convert ascending-band index to descending tier label
      // (matched = tierCount-1 = highest band → descTier 1 = best).
      const descTier = tierCount - matched;
      const bucket = buckets.get(descTier) ?? { tier: descTier, members: [], mean: 0 };
      bucket.members.push(p);
      buckets.set(descTier, bucket);
    }

    // Compute per-bucket mean baseValue.
    const tiers = [...buckets.values()].sort((a, b) => a.tier - b.tier);
    for (const bucket of tiers) {
      const sum = bucket.members.reduce((s, m) => s + (m.baseValue as number), 0);
      bucket.mean = bucket.members.length > 0 ? sum / bucket.members.length : 0;
    }

    // Assign tier metadata + cliff score.
    for (let idx = 0; idx < tiers.length; idx++) {
      const current = tiers[idx];
      const next = tiers[idx + 1] ?? null;
      const gap = next ? Math.max(0, current.mean - next.mean) : 0;

      for (const member of current.members) {
        tierByPlayer.set(member.playerId, {
          playerId: member.playerId,
          tier: current.tier,
          meanBaseValue: current.mean,
          nextTierMeanBaseValue: next ? next.mean : null,
        });

        // P(all OTHER tier-mates taken before next pick) — independence assumption.
        let pAllOthersGone = 1;
        for (const peer of current.members) {
          if (peer.playerId === member.playerId) continue;
          const pPeerStillThere = peer.pAvailAtNext ?? 1;
          pAllOthersGone *= 1 - pPeerStillThere;
        }
        const cliff = pAllOthersGone * gap;
        tierCliffByPlayer.set(member.playerId, cliff);
      }
    }
  }

  return { tierByPlayer, tierCliffByPlayer };
}

export const __test__ = { jenksBreaks };
