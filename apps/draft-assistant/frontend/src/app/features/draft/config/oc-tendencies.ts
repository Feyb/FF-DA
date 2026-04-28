/**
 * Hand-curated offensive-coordinator tendency profiles for all 32 NFL teams.
 * Updated for the 2026 season. Used by the SchemeFit utility.
 *
 * Fields:
 *   proe          — Pass Rate Over Expected bucket (elite|high|avg|low|run_heavy)
 *   pace          — Offensive pace (hurry_up|fast|avg|slow)
 *   personnel11   — 11 personnel (1 RB + 1 TE) usage rate (high|avg|low)
 *   motion        — Pre-snap motion / shift rate (high|avg|low)
 *   passConc      — Aerial concentration index: degree to which targets
 *                   concentrate on top-1 WR vs. spreading (high|avg|low)
 */

export type ProeBucket = "elite" | "high" | "avg" | "low" | "run_heavy";
export type PaceBucket = "hurry_up" | "fast" | "avg" | "slow";
export type FreqBucket = "high" | "avg" | "low";

export interface OcTendency {
  proe: ProeBucket;
  pace: PaceBucket;
  personnel11: FreqBucket;
  motion: FreqBucket;
  passConc: FreqBucket;
}

export const OC_TENDENCIES: Record<string, OcTendency> = {
  ARI: { proe: "high", pace: "fast", personnel11: "high", motion: "high", passConc: "avg" },
  ATL: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  BAL: { proe: "low", pace: "avg", personnel11: "low", motion: "high", passConc: "low" },
  BUF: { proe: "elite", pace: "hurry_up", personnel11: "high", motion: "high", passConc: "avg" },
  CAR: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  CHI: { proe: "high", pace: "fast", personnel11: "high", motion: "high", passConc: "avg" },
  CIN: { proe: "elite", pace: "fast", personnel11: "high", motion: "avg", passConc: "high" },
  CLE: { proe: "low", pace: "slow", personnel11: "avg", motion: "avg", passConc: "avg" },
  DAL: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  DEN: { proe: "high", pace: "fast", personnel11: "high", motion: "high", passConc: "avg" },
  DET: { proe: "avg", pace: "fast", personnel11: "avg", motion: "high", passConc: "avg" },
  GB: { proe: "high", pace: "avg", personnel11: "high", motion: "avg", passConc: "high" },
  HOU: { proe: "high", pace: "fast", personnel11: "high", motion: "high", passConc: "avg" },
  IND: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  JAX: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  KC: { proe: "elite", pace: "fast", personnel11: "high", motion: "high", passConc: "high" },
  LA: { proe: "high", pace: "avg", personnel11: "high", motion: "high", passConc: "avg" },
  LAC: { proe: "high", pace: "avg", personnel11: "high", motion: "avg", passConc: "avg" },
  LV: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  MIA: { proe: "elite", pace: "hurry_up", personnel11: "high", motion: "high", passConc: "avg" },
  MIN: { proe: "high", pace: "fast", personnel11: "high", motion: "avg", passConc: "avg" },
  NE: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  NO: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  NYG: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  NYJ: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  PHI: { proe: "avg", pace: "fast", personnel11: "low", motion: "high", passConc: "avg" },
  PIT: { proe: "low", pace: "slow", personnel11: "low", motion: "avg", passConc: "high" },
  SEA: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
  SF: { proe: "avg", pace: "slow", personnel11: "low", motion: "high", passConc: "low" },
  TB: { proe: "high", pace: "avg", personnel11: "high", motion: "avg", passConc: "high" },
  TEN: { proe: "run_heavy", pace: "slow", personnel11: "low", motion: "low", passConc: "low" },
  WAS: { proe: "avg", pace: "avg", personnel11: "avg", motion: "avg", passConc: "avg" },
};
