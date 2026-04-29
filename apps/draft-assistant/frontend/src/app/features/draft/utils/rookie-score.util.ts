/**
 * Rookie Score — context modifier for players in their first two NFL seasons.
 *
 * Replaces EffScore in ContextMod when mode = 'rookie' and yearsExp <= 1.
 *
 * Formula (spec §3, Phase 3):
 *   WR: 0.35·CapMult + 0.30·z(Dominator) + 0.10·z(BreakoutAge) + 0.10·z(YPTPA) + 0.15·z(RAS)
 *   RB: 0.40·CapMult + 0.25·z(Dominator) + 0.20·z(BreakoutAge) + 0.10·z(YPTPA) + 0.05·z(RAS)
 *   TE: 0.45·CapMult + 0.20·z(Dominator) + 0.20·z(BreakoutAge) + 0.15·z(RAS)
 *   QB: 0.50·CapMult + 0.20·z(Dominator) + 0.20·z(BreakoutAge) + 0.10·z(RAS)
 *
 * When CFBD metrics are unavailable (null), the score is built from CapMult
 * alone, normalized to the same [-2, +2] scale. Returns null only when there is
 * neither capital data nor CFBD data to score with.
 */

import { getCapitalMult } from "../capital-mult";

export interface CfbdMetrics {
  /** Dominator Rating (college target/carry share × scoring share). 0–1 typical range. */
  dominatorRating: number | null;
  /** Age at first 20% Dominator Rating season (lower = earlier breakout). */
  breakoutAge: number | null;
  /** Yards per team pass attempt in final college season. */
  yptpa: number | null;
  /** Relative Athletic Score — composite of combine metrics, 0–10. */
  ras: number | null;
}

export interface RookieScoreInputs {
  playerId: string;
  position: string;
  nflRound: number | null;
  yearsExp: number | null;
  cfbd: CfbdMetrics | null;
}

// Population statistics for z-score normalization, derived from 2019-2025 draft class data.
const CFBD_NORMS: Record<
  string,
  {
    dominatorMean: number;
    dominatorSd: number;
    breakoutMean: number;
    breakoutSd: number;
    yptpaMean: number;
    yptpaSd: number;
    rasMean: number;
    rasSd: number;
  }
> = {
  WR: {
    dominatorMean: 0.21,
    dominatorSd: 0.09,
    breakoutMean: 19.5,
    breakoutSd: 1.2,
    yptpaMean: 1.4,
    yptpaSd: 0.35,
    rasMean: 5.8,
    rasSd: 1.8,
  },
  RB: {
    dominatorMean: 0.28,
    dominatorSd: 0.1,
    breakoutMean: 19.0,
    breakoutSd: 1.1,
    yptpaMean: 1.2,
    yptpaSd: 0.3,
    rasMean: 6.0,
    rasSd: 1.7,
  },
  TE: {
    dominatorMean: 0.18,
    dominatorSd: 0.08,
    breakoutMean: 20.0,
    breakoutSd: 1.3,
    yptpaMean: 0.0,
    yptpaSd: 1.0,
    rasMean: 5.5,
    rasSd: 1.9,
  },
  QB: {
    dominatorMean: 0.25,
    dominatorSd: 0.09,
    breakoutMean: 19.8,
    breakoutSd: 1.2,
    yptpaMean: 1.5,
    yptpaSd: 0.4,
    rasMean: 5.0,
    rasSd: 2.0,
  },
};

function z(value: number | null, mean: number, sd: number): number | null {
  if (value === null || sd === 0) return null;
  return Math.max(-3, Math.min(3, (value - mean) / sd));
}

// Flip breakoutAge: younger = better, so negate the z-score.
function zBreakout(age: number | null, mean: number, sd: number): number | null {
  const raw = z(age, mean, sd);
  return raw === null ? null : -raw;
}

/**
 * Maps a CapitalMult (0.70–1.30) to a comparable z-score-like scale [−1.5, +1.5].
 * CapMult=1.0 (neutral) → 0; CapMult=1.25 (elite) → ~1.5; CapMult=0.70 (UDFA) → ~-1.5.
 */
function capMultToZScale(capMult: number): number {
  return Math.max(-1.5, Math.min(1.5, (capMult - 1.0) * 5));
}

type PosFn = (
  capZ: number,
  norms: (typeof CFBD_NORMS)[string],
  cfbd: CfbdMetrics | null,
) => number | null;

const POSITION_FN: Record<string, PosFn> = {
  WR: (capZ, n, cfbd) => {
    const dom = cfbd ? z(cfbd.dominatorRating, n.dominatorMean, n.dominatorSd) : null;
    const ba = cfbd ? zBreakout(cfbd.breakoutAge, n.breakoutMean, n.breakoutSd) : null;
    const yp = cfbd ? z(cfbd.yptpa, n.yptpaMean, n.yptpaSd) : null;
    const ras = cfbd ? z(cfbd.ras, n.rasMean, n.rasSd) : null;
    if (dom === null && ba === null && yp === null && ras === null) {
      return capZ === 0 ? null : capZ * 0.35;
    }
    return 0.35 * capZ + 0.3 * (dom ?? 0) + 0.1 * (ba ?? 0) + 0.1 * (yp ?? 0) + 0.15 * (ras ?? 0);
  },
  RB: (capZ, n, cfbd) => {
    const dom = cfbd ? z(cfbd.dominatorRating, n.dominatorMean, n.dominatorSd) : null;
    const ba = cfbd ? zBreakout(cfbd.breakoutAge, n.breakoutMean, n.breakoutSd) : null;
    const yp = cfbd ? z(cfbd.yptpa, n.yptpaMean, n.yptpaSd) : null;
    const ras = cfbd ? z(cfbd.ras, n.rasMean, n.rasSd) : null;
    if (dom === null && ba === null && yp === null && ras === null) {
      return capZ === 0 ? null : capZ * 0.4;
    }
    return 0.4 * capZ + 0.25 * (dom ?? 0) + 0.2 * (ba ?? 0) + 0.1 * (yp ?? 0) + 0.05 * (ras ?? 0);
  },
  TE: (capZ, n, cfbd) => {
    const dom = cfbd ? z(cfbd.dominatorRating, n.dominatorMean, n.dominatorSd) : null;
    const ba = cfbd ? zBreakout(cfbd.breakoutAge, n.breakoutMean, n.breakoutSd) : null;
    const ras = cfbd ? z(cfbd.ras, n.rasMean, n.rasSd) : null;
    if (dom === null && ba === null && ras === null) {
      return capZ === 0 ? null : capZ * 0.45;
    }
    return 0.45 * capZ + 0.2 * (dom ?? 0) + 0.2 * (ba ?? 0) + 0.15 * (ras ?? 0);
  },
  QB: (capZ, n, cfbd) => {
    const dom = cfbd ? z(cfbd.dominatorRating, n.dominatorMean, n.dominatorSd) : null;
    const ba = cfbd ? zBreakout(cfbd.breakoutAge, n.breakoutMean, n.breakoutSd) : null;
    const ras = cfbd ? z(cfbd.ras, n.rasMean, n.rasSd) : null;
    if (dom === null && ba === null && ras === null) {
      return capZ === 0 ? null : capZ * 0.5;
    }
    return 0.5 * capZ + 0.2 * (dom ?? 0) + 0.2 * (ba ?? 0) + 0.1 * (ras ?? 0);
  },
};

/**
 * Compute a z-score-scale Rookie Score for a single player.
 * Returns null when no usable data is present.
 */
export function computeRookieScore(inputs: RookieScoreInputs): number | null {
  if (inputs.yearsExp !== null && inputs.yearsExp > 2) return null;

  const norms = CFBD_NORMS[inputs.position];
  if (!norms) return null;

  const capMult = getCapitalMult(inputs.position, inputs.nflRound, inputs.yearsExp);
  const capZ = capMultToZScale(capMult);
  const fn = POSITION_FN[inputs.position];
  if (!fn) return null;

  return fn(capZ, norms, inputs.cfbd);
}

/**
 * Batch-compute rookie scores, returning a map of playerId → score | null.
 * Veterans (yearsExp > 2) are omitted from the map.
 */
export function buildRookieScoreMap(inputs: RookieScoreInputs[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const inp of inputs) {
    if (inp.yearsExp !== null && inp.yearsExp > 2) continue;
    out.set(inp.playerId, computeRookieScore(inp));
  }
  return out;
}
