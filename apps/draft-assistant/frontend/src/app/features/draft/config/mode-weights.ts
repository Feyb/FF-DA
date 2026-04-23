/**
 * Draft mode determines which weight set is applied to the consensus aggregator,
 * NeedMultiplier, and ContextMod. Three modes are supported:
 *   - startup:  dynasty startup draft (long-horizon, age matters most)
 *   - rookie:   rookie-only draft (NFL draft capital dominant)
 *   - redraft:  single-season redraft (in-season production dominant)
 */
export type DraftMode = "startup" | "rookie" | "redraft";

/**
 * Per-source weights for the consensus aggregator.
 * Keys must match the `source` strings used in ConsensusInput observations.
 * Weights are renormalized per-player after dropping missing sources —
 * they do not need to sum to 1.
 */
export const SOURCE_WEIGHTS: Record<DraftMode, Record<string, number>> = {
  startup: {
    ktc: 0.3,
    flock: 0.2, // veteran rank (flock main)
    flockRookie: 0.05,
    fantasycalc: 0.25,
    fpAdp: 0.2,
    ffcAdp: 0.0,
    projection: 0.05,
  },
  rookie: {
    ktc: 0.2,
    flock: 0.0,
    flockRookie: 0.45,
    fantasycalc: 0.15,
    fpAdp: 0.1,
    ffcAdp: 0.0,
    projection: 0.1,
  },
  redraft: {
    ktc: 0.05,
    flock: 0.2,
    flockRookie: 0.05,
    fantasycalc: 0.15,
    fpAdp: 0.05,
    ffcAdp: 0.0,
    projection: 0.5,
  },
};

/**
 * NeedMultiplier mode weights.
 *   alpha: unfilled-starter gain
 *   beta:  stacked-at-position penalty
 *   gamma: stack synergy bonus (QB + pass-catcher already on roster)
 *   delta: bye-cluster penalty
 */
export const NEED_WEIGHTS: Record<
  DraftMode,
  { alpha: number; beta: number; gamma: number; delta: number }
> = {
  startup: { alpha: 0.25, beta: 0.3, gamma: 0.05, delta: 0.0 },
  rookie: { alpha: 0.15, beta: 0.1, gamma: 0.0, delta: 0.0 },
  redraft: { alpha: 0.35, beta: 0.2, gamma: 0.08, delta: 0.05 },
};

/**
 * ContextMod exponents applied to AgeMult per mode:
 *   startup → full curve (^1.0)
 *   rookie  → attenuated (^0.5), most prospects are 21-23
 *   redraft → minimal (^0.25), year-one production barely drops 27→28
 */
export const AGE_MULT_EXPONENT: Record<DraftMode, number> = {
  startup: 1.0,
  rookie: 0.5,
  redraft: 0.25,
};

/** Human-readable labels for the mode selector UI. */
export const DRAFT_MODE_LABELS: Record<DraftMode, string> = {
  startup: "Startup / Dynasty",
  rookie: "Rookie Draft",
  redraft: "Redraft / Win-now",
};
