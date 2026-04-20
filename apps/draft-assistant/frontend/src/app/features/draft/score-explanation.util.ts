/**
 * Score-explanation utility — turns the WCS contributions into a short,
 * human-readable "why this pick?" string.
 *
 * Phase 1 supports the templates that don't depend on Phase 2 data sources
 * (efficiency stats, NFL draft capital, scheme fit, injuries). The remaining
 * templates from the design doc are stubbed and added incrementally as data
 * becomes available.
 */

export interface ExplanationSignals {
  baseValue: number | null;
  baseValueDivergence: number | null;
  pAvailAtNext: number | null;
  tierCliffScore: number | null;
  /** Mean baseValue of next tier; null if no next tier. */
  nextTierMeanBaseValue: number | null;
  /** Mean baseValue of this tier. */
  thisTierMeanBaseValue: number | null;
  /** 1-indexed tier label. */
  tier: number | null;
  /** ADP-vs-consensus delta (positive = falling to you). */
  adpDelta: number | null;
  /** ADP mean pick number (for "ADP says pick X" template). */
  adpMean: number | null;
  /** Current pick number when the explanation was generated. */
  currentPickNumber: number;
  /** Player age (for age-curve templates). */
  age: number | null;
  /** Player position. */
  position: "QB" | "RB" | "WR" | "TE";
  /** Number of position picks in the trailing run-window. */
  positionRunCount: number;
  /** Run-window size (for the count denominator). */
  positionRunWindow: number;
}

export interface ExplanationOptions {
  /** Maximum number of clauses to include (default 3). */
  maxClauses?: number;
}

interface Clause {
  /** Magnitude used to rank clauses; larger = surfaced first. */
  magnitude: number;
  text: string;
}

const POSITION_RUN_THRESHOLD = 0.45;
const FALLER_DELTA_THRESHOLD = 1.0;
const FALLER_AVAIL_THRESHOLD = 0.4;
const TIER_CLIFF_REPORT_THRESHOLD = 1.0;

const YOUNG_AGE_BY_POS: Record<string, number> = {
  RB: 24,
  WR: 25,
  TE: 25,
  QB: 26,
};

const AGE_RISK_BY_POS: Record<string, number> = {
  RB: 28,
  WR: 30,
  TE: 31,
  QB: 35,
};

export function generateExplanation(
  signals: ExplanationSignals,
  options: ExplanationOptions = {},
): string {
  const maxClauses = options.maxClauses ?? 3;
  const clauses: Clause[] = [];

  // #1 Faller / value
  if (
    signals.adpDelta !== null &&
    signals.adpDelta >= FALLER_DELTA_THRESHOLD &&
    (signals.pAvailAtNext === null || signals.pAvailAtNext <= FALLER_AVAIL_THRESHOLD) &&
    signals.adpMean !== null
  ) {
    const adpMeanRounded = Math.round(signals.adpMean);
    clauses.push({
      magnitude: signals.adpDelta * 10,
      text: `Falling: ADP ${adpMeanRounded}, here at pick ${signals.currentPickNumber}`,
    });
  }

  // #2 Tier cliff
  if (
    signals.tierCliffScore !== null &&
    signals.tierCliffScore >= TIER_CLIFF_REPORT_THRESHOLD &&
    signals.nextTierMeanBaseValue !== null &&
    signals.thisTierMeanBaseValue !== null
  ) {
    const drop = Math.round(signals.thisTierMeanBaseValue - signals.nextTierMeanBaseValue);
    const tierLabel = signals.tier !== null ? `Tier ${signals.tier}` : "this tier";
    clauses.push({
      magnitude: signals.tierCliffScore * 5,
      text: `${tierLabel} cliff: drops ~${drop} BaseValue if you wait`,
    });
  }

  // #3 Position run
  const runRate =
    signals.positionRunWindow > 0 ? signals.positionRunCount / signals.positionRunWindow : 0;
  if (runRate >= POSITION_RUN_THRESHOLD && signals.positionRunCount >= 3) {
    clauses.push({
      magnitude: runRate * 30,
      text: `${signals.position} run: ${signals.positionRunCount} of last ${signals.positionRunWindow} picks`,
    });
  }

  // #9/#11 Age curve flags
  if (signals.age !== null) {
    const youngThreshold = YOUNG_AGE_BY_POS[signals.position];
    const riskThreshold = AGE_RISK_BY_POS[signals.position];
    if (youngThreshold !== undefined && signals.age <= youngThreshold) {
      clauses.push({
        magnitude: 8,
        text: `Young (${signals.age}): on the rising side of the ${signals.position} curve`,
      });
    } else if (riskThreshold !== undefined && signals.age >= riskThreshold) {
      clauses.push({
        magnitude: 6,
        text: `Age risk (${signals.age}): ${signals.position} value drops sharply from here`,
      });
    }
  }

  // Divergence flag — surfaces ranker disagreement when value-positive.
  if (
    signals.baseValueDivergence !== null &&
    signals.baseValueDivergence >= 0.7 &&
    signals.adpDelta !== null &&
    signals.adpDelta > 0
  ) {
    clauses.push({
      magnitude: signals.baseValueDivergence * 5,
      text: `Splits rankings: sources disagree, market is undervaluing`,
    });
  }

  if (clauses.length === 0) {
    return "";
  }

  return clauses
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, maxClauses)
    .map((c) => c.text)
    .join(" \u2022 ");
}
