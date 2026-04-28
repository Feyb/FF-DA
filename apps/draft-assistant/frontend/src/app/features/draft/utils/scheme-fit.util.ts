/**
 * Scheme Fit — measures how well a player's archetype matches their
 * team's offensive-coordinator tendencies.
 *
 * Returns a score in [−1, +1]. Applied in ContextMod as:
 *   schemeFitMult = 1 + 0.10 × schemeFit
 *
 * Player archetype is inferred from NGS/PFR stats (when available) or
 * falls back to positional heuristics. OC tendencies are hand-curated in
 * oc-tendencies.ts and updated each offseason.
 */

import { OC_TENDENCIES, OcTendency, ProeBucket } from "../config/oc-tendencies";

export interface SchemeFitInputs {
  playerId: string;
  position: string;
  team: string | null;
  /** Average Depth of Target (yards) from NGS — indicates route style. */
  aDot: number | null;
  /** Snap share 0–1 from nflverse rosters. */
  snapShare: number | null;
  /** Depth chart order (1 = starter). */
  depthChartOrder: number | null;
}

// PROE bucket → pass-volume score (0–1).
const PROE_VOLUME: Record<ProeBucket, number> = {
  elite: 1.0,
  high: 0.75,
  avg: 0.5,
  low: 0.25,
  run_heavy: 0.0,
};

function scoreBucket(bucket: "high" | "avg" | "low"): number {
  return bucket === "high" ? 1.0 : bucket === "avg" ? 0.5 : 0.0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Compute a per-position scheme-fit score in [0, 1].
function positionalFit(pos: string, tendency: OcTendency, inputs: SchemeFitInputs): number {
  const passVol = PROE_VOLUME[tendency.proe];
  const p11 = scoreBucket(tendency.personnel11);
  const motion = scoreBucket(tendency.motion);
  const conc = scoreBucket(tendency.passConc);
  const pace =
    tendency.pace === "hurry_up"
      ? 1.0
      : tendency.pace === "fast"
        ? 0.75
        : tendency.pace === "avg"
          ? 0.5
          : 0.25;

  switch (pos) {
    case "WR": {
      // WRs benefit from high pass vol, 11-personnel, high motion, fast pace.
      // Deep routes (aDOT > 12) fit better in high-conc systems.
      const depthFit =
        inputs.aDot !== null ? (inputs.aDot >= 12 ? conc : (1 - conc) * 0.5 + 0.5) : 0.5;
      return 0.35 * passVol + 0.25 * p11 + 0.2 * pace + 0.1 * motion + 0.1 * depthFit;
    }
    case "RB": {
      // RBs hurt by high pass vol (fewer carries); benefit from multi-back
      // or 21-personnel (low p11). Fast pace inflates volume.
      return 0.4 * (1 - passVol) + 0.3 * (1 - p11) + 0.2 * pace + 0.1 * motion;
    }
    case "TE": {
      // TEs benefit from low p11 (inline blocking / 12-personnel), low conc
      // (targets distributed away from WR1), and high motion.
      return 0.35 * (1 - p11) + 0.3 * passVol + 0.2 * (1 - conc) + 0.15 * motion;
    }
    case "QB": {
      // QB benefits from fast pace, high pass vol, high motion (play-action).
      return 0.4 * passVol + 0.3 * pace + 0.2 * p11 + 0.1 * motion;
    }
    default:
      return 0.5;
  }
}

/**
 * Compute scheme fit for a single player.
 *
 * @returns Value in [−1, +1] where +1 = ideal fit, −1 = adverse fit, 0 = neutral.
 *          Returns 0 when the team is unknown or not in the OC tendency table.
 */
export function computeSchemeFit(inputs: SchemeFitInputs): number {
  if (!inputs.team) return 0;
  const tendency = OC_TENDENCIES[inputs.team.toUpperCase()];
  if (!tendency) return 0;

  const rawFit = positionalFit(inputs.position, tendency, inputs);

  // Map [0, 1] → [−1, +1] (0.5 → 0 = neutral).
  const centered = (rawFit - 0.5) * 2;
  return clamp(centered, -1, 1);
}

/**
 * Batch-compute scheme fit, returning Map<playerId, schemeFit>.
 */
export function buildSchemeFitMap(inputs: SchemeFitInputs[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const inp of inputs) {
    out.set(inp.playerId, computeSchemeFit(inp));
  }
  return out;
}

/** Convert schemeFit [−1, +1] to a ContextMod multiplier. */
export function schemeFitMult(schemeFit: number): number {
  return 1 + 0.1 * schemeFit;
}
