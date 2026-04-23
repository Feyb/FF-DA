/**
 * Per-position age multiplier tables for ContextMod.
 *
 * Values synthesized from Fantasy Points (Heath), ESPN (Clay), Apex Fantasy,
 * Fantasy Footballers, Footballguys (Harstad), PFF, and Rotoviz (Andrews).
 * Peak ages: RB 24, WR 26, TE 27, QB 29 (pocket) / 24-25 (dual-threat).
 *
 * Mode exponents (from AGE_MULT_EXPONENT in mode-weights.ts):
 *   startup  → ^1.0 (full curve — long-horizon dynasty value)
 *   rookie   → ^0.5 (most prospects are 21-23; curve is flat there)
 *   redraft  → ^0.25 (year-one production barely drops 27→28)
 */

import type { DraftMode } from "./config/mode-weights";
import { AGE_MULT_EXPONENT } from "./config/mode-weights";

export const RB_AGE_MULT: Record<number, number> = {
  21: 1.02, 22: 1.05, 23: 1.08, 24: 1.10, 25: 1.08, 26: 1.00,
  27: 0.90, 28: 0.78, 29: 0.62, 30: 0.45, 31: 0.30, 32: 0.20,
};

export const WR_AGE_MULT: Record<number, number> = {
  21: 0.92, 22: 0.98, 23: 1.03, 24: 1.07, 25: 1.09, 26: 1.10,
  27: 1.09, 28: 1.06, 29: 1.00, 30: 0.90, 31: 0.78, 32: 0.65,
  33: 0.50, 34: 0.35, 35: 0.22,
};

export const TE_AGE_MULT: Record<number, number> = {
  22: 0.45, 23: 0.75, 24: 0.90, 25: 1.00, 26: 1.08, 27: 1.10,
  28: 1.08, 29: 1.05, 30: 1.00, 31: 0.92, 32: 0.80, 33: 0.62,
  34: 0.45, 35: 0.30,
};

export const QB_AGE_MULT: Record<number, number> = {
  22: 0.80, 23: 0.88, 24: 0.95, 25: 1.00, 26: 1.04, 27: 1.07,
  28: 1.09, 29: 1.10, 30: 1.10, 31: 1.08, 32: 1.05, 33: 1.00,
  34: 0.93, 35: 0.85, 36: 0.75, 37: 0.60, 38: 0.45, 39: 0.30, 40: 0.20,
};

/** Applied when pctRushingPoints in prior season ≥ 15 %. */
export const QB_AGE_MULT_DUAL: Record<number, number> = {
  22: 1.00, 23: 1.06, 24: 1.10, 25: 1.10, 26: 1.08, 27: 1.03,
  28: 0.95, 29: 0.85, 30: 0.72, 31: 0.60, 32: 0.48, 33: 0.38, 34: 0.30,
};

const AGE_TABLES: Record<string, Record<number, number>> = {
  RB: RB_AGE_MULT,
  WR: WR_AGE_MULT,
  TE: TE_AGE_MULT,
  QB: QB_AGE_MULT,
};

/**
 * Look up the age multiplier for a player.
 *
 * Interpolates linearly for fractional ages between table entries.
 * Clamps to the nearest defined boundary for ages outside the table range.
 * Applies the mode exponent (startup=^1.0, rookie=^0.5, redraft=^0.25).
 */
export function getAgeMult(
  position: string,
  age: number | null,
  mode: DraftMode,
  isDualThreat = false,
): number {
  if (age === null) return 1.0;

  const table =
    position === "QB" && isDualThreat ? QB_AGE_MULT_DUAL : (AGE_TABLES[position] ?? null);
  if (!table) return 1.0;

  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const minAge = keys[0];
  const maxAge = keys[keys.length - 1];

  // Clamp outside range.
  if (age <= minAge) return Math.pow(table[minAge], AGE_MULT_EXPONENT[mode]);
  if (age >= maxAge) return Math.pow(table[maxAge], AGE_MULT_EXPONENT[mode]);

  // Linear interpolation between floor and ceil.
  const lo = Math.floor(age);
  const hi = lo + 1;
  const fraction = age - lo;
  const multLo = table[lo] ?? table[minAge];
  const multHi = table[hi] ?? table[maxAge];
  const mult = multLo + (multHi - multLo) * fraction;
  return Math.pow(mult, AGE_MULT_EXPONENT[mode]);
}
