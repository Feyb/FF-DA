/**
 * Score-explanation utility — turns WCS contributions into a short,
 * human-readable "why this pick?" string.
 *
 * Templates implemented (numbers match spec §6):
 *   #1  Faller / value
 *   #2  Tier cliff
 *   #3  Position run
 *   #4  Fills roster slot (NeedMultiplier ≥ 1.3)
 *   #9  Young asset (rising side of curve)
 *   #10 Prime window (redraft, age 27-29)
 *   #11 Age risk (declining side)
 *   #14 Bye-week cluster warning (stub — fires when byeWeekCluster=true)
 *   #16 Ranker divergence / splits
 *   #13 Scheme fit (good or adverse)
 *   #18 Early breakout age (rookie)
 *   #19 Elite athleticism / RAS (rookie)
 *   #20 Vacated targets / landing spot
 *   #22 Win-now bonus (startup mode, prime age)
 */

import type { DraftMode } from "./config/mode-weights";

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
  /** NeedMultiplier for this player (from roster analysis). */
  needMultiplier?: number;
  /** Active draft mode. */
  draftMode?: DraftMode;
  /** Bye-week cluster flag (3+ of the user's picks share this player's bye week). */
  byeWeekCluster?: boolean;
  // Phase 2 signals — optional until nflverse data lands.
  /** NFL draft round (1-7; 8 = UDFA). Null for veterans. */
  nflRound?: number | null;
  /** Efficiency score z-composite (position-normalized). */
  effScore?: number | null;
  /** Position-specific display stats for efficiency template. */
  effDisplayStats?: {
    wopr?: number;
    yprr?: number;
    cpoe?: number;
    weightedOpportunity?: number;
  } | null;
  /** VNP score (Value over Next Pick). */
  vnp?: number | null;
  /** QB name on the user's roster that shares this player's team (pass-catchers only). */
  stackSynergyQbName?: string | null;
  /** Number of Sleeper adds for this player in the last 24 h (null = not in top-100). */
  trendingAdds?: number | null;
  /** Active Sleeper injury designation string (e.g. "Questionable", "Out", "IR"). */
  injuryStatus?: string | null;
  // Phase 3 signals — optional until CFBD/scheme data lands.
  /** Scheme fit in [−1, +1]; positive = player archetype matches team OC tendencies. */
  schemeFit?: number | null;
  /** Player's team abbreviation (e.g. "KC") for scheme-fit display. */
  team?: string | null;
  /** Age at first 20% Dominator Rating season (lower = earlier breakout). */
  breakoutAge?: number | null;
  /** Relative Athletic Score from NFL combine (0–10). */
  ras?: number | null;
  /** Vacated target share at landing team (0–1). */
  landingVacatedTargetPct?: number | null;
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
const NEED_MULT_THRESHOLD = 1.3;

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

// Age range for "prime window" template (#10) — used in redraft mode.
const PRIME_WINDOW_MIN = 27;
const PRIME_WINDOW_MAX = 29;

export function generateExplanation(
  signals: ExplanationSignals,
  options: ExplanationOptions = {},
): string {
  const maxClauses = options.maxClauses ?? 3;
  const clauses: Clause[] = [];
  const mode = signals.draftMode ?? "startup";

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
      text: `🔥 Falling: ADP ${adpMeanRounded}, here at pick ${signals.currentPickNumber}`,
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
      text: `⚠️ ${tierLabel} cliff: drops ~${drop} BaseValue if you wait`,
    });
  }

  // #3 Position run
  const runRate =
    signals.positionRunWindow > 0 ? signals.positionRunCount / signals.positionRunWindow : 0;
  if (runRate >= POSITION_RUN_THRESHOLD && signals.positionRunCount >= 3) {
    clauses.push({
      magnitude: runRate * 30,
      text: `📉 ${signals.position} run: ${signals.positionRunCount} of last ${signals.positionRunWindow} picks`,
    });
  }

  // #4 Fills roster slot (NeedMultiplier high)
  if (signals.needMultiplier !== undefined && signals.needMultiplier >= NEED_MULT_THRESHOLD) {
    clauses.push({
      magnitude: (signals.needMultiplier - 1) * 40,
      text: `🎯 Fills a needed ${signals.position} slot`,
    });
  }

  // #9 / #10 / #11 Age curve flags
  if (signals.age !== null) {
    const youngThreshold = YOUNG_AGE_BY_POS[signals.position];
    const riskThreshold = AGE_RISK_BY_POS[signals.position];

    if (mode === "redraft" && signals.age >= PRIME_WINDOW_MIN && signals.age <= PRIME_WINDOW_MAX) {
      // #10 Prime window — redraft mode only
      clauses.push({
        magnitude: 9,
        text: `⏳ Prime window: age ${signals.age}, proven producer`,
      });
    } else if (youngThreshold !== undefined && signals.age <= youngThreshold) {
      // #9 Young asset
      clauses.push({
        magnitude: 8,
        text: `🌱 Young (${signals.age}): rising side of the ${signals.position} curve`,
      });
    } else if (riskThreshold !== undefined && signals.age >= riskThreshold) {
      // #11 Age risk
      clauses.push({
        magnitude: 6,
        text: `📉 Age risk (${signals.age}): ${signals.position} value drops sharply from here`,
      });
    }
  }

  // #5 Elite NFL draft capital (rookie, R1-R2)
  if (signals.nflRound !== null && signals.nflRound !== undefined && signals.nflRound <= 2) {
    clauses.push({
      magnitude: (3 - signals.nflRound) * 12,
      text: `🏈 Elite NFL draft capital (Round ${signals.nflRound})`,
    });
  }

  // #6 Elite efficiency — WR / TE
  if (
    signals.effScore !== null &&
    signals.effScore !== undefined &&
    signals.effScore >= 1.5 &&
    (signals.position === "WR" || signals.position === "TE")
  ) {
    const d = signals.effDisplayStats;
    const detail = d?.yprr !== undefined ? ` · ${d.yprr.toFixed(2)} YPRR` : "";
    const woprStr = d?.wopr !== undefined ? ` · ${(d.wopr * 100).toFixed(0)}% WOPR` : "";
    clauses.push({
      magnitude: signals.effScore * 8,
      text: `📈 Elite efficiency${detail}${woprStr}`,
    });
  }

  // #7 Elite volume — RB
  if (
    signals.effScore !== null &&
    signals.effScore !== undefined &&
    signals.effScore >= 1.5 &&
    signals.position === "RB"
  ) {
    const d = signals.effDisplayStats;
    const detail =
      d?.weightedOpportunity !== undefined ? ` · ${d.weightedOpportunity.toFixed(1)} wtd opp` : "";
    clauses.push({
      magnitude: signals.effScore * 8,
      text: `🏋 Elite volume${detail}`,
    });
  }

  // #8 Elite accuracy — QB
  if (
    signals.effScore !== null &&
    signals.effScore !== undefined &&
    signals.effScore >= 1.5 &&
    signals.position === "QB"
  ) {
    const d = signals.effDisplayStats;
    const cpoeStr =
      d?.cpoe !== undefined ? ` · ${d.cpoe > 0 ? "+" : ""}${d.cpoe.toFixed(1)} CPOE` : "";
    clauses.push({
      magnitude: signals.effScore * 8,
      text: `🎯 Elite accuracy${cpoeStr}`,
    });
  }

  // #15 VNP — big drop after this pick
  if (
    signals.vnp !== null &&
    signals.vnp !== undefined &&
    signals.vnp > 0.3 &&
    signals.pAvailAtNext !== null &&
    signals.pAvailAtNext !== undefined &&
    signals.pAvailAtNext < 0.4
  ) {
    clauses.push({
      magnitude: signals.vnp * 35,
      text: `📊 VONA drop: next-best ${signals.position} at your turn projects significantly less`,
    });
  }

  // #14 Bye-week cluster warning
  if (signals.byeWeekCluster) {
    clauses.push({
      magnitude: 7,
      text: `⛔ Bye-week cluster: 3+ of your picks already share this bye`,
    });
  }

  // #16 Ranker divergence / splits
  if (
    signals.baseValueDivergence !== null &&
    signals.baseValueDivergence >= 0.7 &&
    signals.adpDelta !== null &&
    signals.adpDelta > 0
  ) {
    clauses.push({
      magnitude: signals.baseValueDivergence * 5,
      text: `🎭 Splits rankings: sources disagree, market is undervaluing`,
    });
  }

  // #12 QB stack synergy
  if (signals.stackSynergyQbName && signals.position !== "QB") {
    clauses.push({
      magnitude: 11,
      text: `🔗 QB stack with ${signals.stackSynergyQbName} (on your roster)`,
    });
  }

  // #17 Sleeper trending adds
  if (signals.trendingAdds !== null && signals.trendingAdds !== undefined) {
    clauses.push({
      magnitude: 14,
      text: `🔥 Trending: +${signals.trendingAdds.toLocaleString()} adds in last 24h`,
    });
  }

  // #21 Injury designation
  if (signals.injuryStatus) {
    const statusLower = signals.injuryStatus.toLowerCase();
    const magnitude =
      statusLower === "out" || statusLower === "ir" || statusLower === "pup"
        ? 21
        : statusLower === "doubtful"
          ? 15
          : 10;
    clauses.push({
      magnitude,
      text: `🏥 ${signals.injuryStatus}`,
    });
  }

  // #22 Win-now bonus — startup mode, prime age + strong base value
  if (
    mode === "startup" &&
    signals.age !== null &&
    signals.age >= 24 &&
    signals.age <= 29 &&
    signals.baseValue !== null &&
    signals.baseValue >= 70
  ) {
    clauses.push({
      magnitude: 5,
      text: `💪 Win-now asset: prime age (${signals.age}) and top-tier value`,
    });
  }

  // #13 Scheme fit (positive or adverse)
  if (signals.schemeFit !== null && signals.schemeFit !== undefined) {
    const teamLabel = signals.team ? ` (${signals.team})` : "";
    if (signals.schemeFit >= 0.4) {
      clauses.push({
        magnitude: signals.schemeFit * 18,
        text: `🏟️ Scheme fit${teamLabel}: system plays to his strengths`,
      });
    } else if (signals.schemeFit <= -0.4) {
      clauses.push({
        magnitude: Math.abs(signals.schemeFit) * 14,
        text: `⚠️ Scheme mismatch${teamLabel}: system works against his archetype`,
      });
    }
  }

  // #18 Early breakout age (rookie)
  if (
    signals.breakoutAge !== null &&
    signals.breakoutAge !== undefined &&
    signals.breakoutAge <= 19 &&
    signals.nflRound !== null &&
    signals.nflRound !== undefined
  ) {
    clauses.push({
      magnitude: (20 - signals.breakoutAge) * 3,
      text: `⚡ Early breakout (age ${signals.breakoutAge}): elite college production young`,
    });
  }

  // #19 Elite athleticism (RAS)
  if (signals.ras !== null && signals.ras !== undefined && signals.ras >= 8.5) {
    clauses.push({
      magnitude: (signals.ras - 8.5) * 10 + 8,
      text: `🏃 Elite athleticism (RAS ${signals.ras.toFixed(1)}/10)`,
    });
  }

  // #20 Vacated targets / landing spot
  if (
    signals.landingVacatedTargetPct !== null &&
    signals.landingVacatedTargetPct !== undefined &&
    signals.landingVacatedTargetPct >= 0.15
  ) {
    const pct = Math.round(signals.landingVacatedTargetPct * 100);
    const teamLabel = signals.team ? ` at ${signals.team}` : "";
    clauses.push({
      magnitude: signals.landingVacatedTargetPct * 80,
      text: `📬 Vacated targets: ${pct}% target share available${teamLabel}`,
    });
  }

  if (clauses.length === 0) {
    return "";
  }

  return clauses
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, maxClauses)
    .map((c) => c.text)
    .join(" • ");
}
