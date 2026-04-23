/**
 * ContextMod — per-player multiplier combining age curve, NFL draft capital,
 * and efficiency score.
 *
 * Formula (spec §3):
 *   ContextMod = AgeMult(age, pos, mode) × CapitalMult(round, yearsExp) × EffMult
 *   EffMult    = 1 + 0.15 · clamp(EffScore, -2, +2)   → [0.70, 1.30]
 *   SchemeFit  = 1 + 0.10 · fit                        → [0.90, 1.10] (Phase 3)
 *
 * Used as a direct multiplier on BaseValue before NeedMultiplier in the WCS:
 *   WCS = BaseValue × ContextMod × NeedMultiplier × (1 + BoardStateAdj)
 */

import type { DraftMode } from "../config/mode-weights";
import { getAgeMult } from "../age-curves";
import { getCapitalMult } from "../capital-mult";
import { getEffMultiplier } from "./efficiency-score.util";

export interface ContextModInputs {
  playerId: string;
  position: string;
  /** Decimal age (e.g. 24.3). Null → multiplier defaults to 1.0. */
  age: number | null;
  /** NFL draft round (1-7). Null for veterans or UDFA (use 8). */
  nflRound: number | null;
  /** Years of NFL experience. Null = unknown. */
  yearsExp: number | null;
  /** Whether the QB has ≥ 15 % rushing-point share (dual-threat flag). */
  isDualThreat?: boolean;
  /** Raw EffScore composite (from computeEffScores). Null = insufficient data. */
  effScore: number | null;
  /** SchemeFit score in [-1, +1]. Null until Phase 3. */
  schemeFit?: number | null;
}

/**
 * Compute ContextMod for a single player. Returns a multiplier ≥ 0 (typical
 * range ≈ 0.5–1.6 depending on age/capital/efficiency).
 */
export function contextModFor(inputs: ContextModInputs, mode: DraftMode): number {
  const ageMult = getAgeMult(inputs.position, inputs.age, mode, inputs.isDualThreat ?? false);
  const capMult = getCapitalMult(inputs.position, inputs.nflRound, inputs.yearsExp);
  const effMult = getEffMultiplier(inputs.effScore);
  // SchemeFit stub: 1.0 until Phase 3 populates the OC tendency map.
  const schemeMult =
    inputs.schemeFit !== null && inputs.schemeFit !== undefined
      ? 1 + 0.10 * Math.max(-1, Math.min(1, inputs.schemeFit))
      : 1.0;

  return ageMult * capMult * effMult * schemeMult;
}

/**
 * Build ContextMod for a pool of players, returning a Map<playerId, contextMod>.
 */
export function buildContextModMap(
  inputs: ContextModInputs[],
  mode: DraftMode,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of inputs) {
    out.set(p.playerId, contextModFor(p, mode));
  }
  return out;
}
