/**
 * Efficiency Score (EffScore) — position-specific composite from nflverse data.
 *
 * Composites from spec §3:
 *   WR: 0.35·z(WOPR) + 0.25·z(RouteRate) + 0.20·z(YPRR) + 0.15·z(TPRR) + 0.05·z(aDOT)
 *   TE: 0.30·z(RouteRate) + 0.30·z(TPRR) + 0.20·z(YPRR) + 0.20·z(TargetShare)
 *   RB: 0.45·z(WeightedOpportunity) + 0.25·z(RouteRate) + 0.15·z(SnapShare) + 0.10·z(YACO/A) + 0.05·z(BrokenTackles/Att)
 *   QB: 0.50·z(EPA/dropback) + 0.30·z(CPOE) + 0.20·z(RushEPA)
 *
 * All z-scores are computed within position group. Returns null for players
 * with < 6 games (insufficient sample; no penalty applied to WCS).
 * Final composite contribution is capped: 1 + 0.15·clamp(EffScore, -2, +2).
 *
 * Research anchors:
 *   - YPRR r≈0.51 next-season FP (SumerSports); WOPR (Hermsmeyer)
 *   - Weighted Opportunity (Scott Barrett / Fantasy Points)
 *   - EPA/dropback + CPOE composite (Ben Baldwin / nflfastR)
 */

import type {
  NflversePlayerStats,
  NflversePfrStats,
  NflverseNgsStats,
  NflverseFfOpportunity,
} from "../../../core/adapters/nflverse/nflverse.service";

export interface EffScoreInputs {
  playerId: string;
  position: string;
  games: number;
  // WR / TE
  wopr?: number;
  routeRate?: number; // routes / snap_pct proxy
  yprr?: number;
  tprr?: number;
  aDot?: number;
  targetShare?: number;
  // RB
  weightedOpportunity?: number;
  snapPct?: number;
  yacoPerAtt?: number;
  brokenTacklesPerAtt?: number;
  rushingAttempts?: number;
  // QB
  epaPerDropback?: number;
  cpoe?: number;
  rushEpa?: number;
}

interface ZEntry {
  value: number;
  playerId: string;
  position: string;
}

function zScoreMap(entries: ZEntry[]): Map<string, number> {
  const byPos = new Map<string, ZEntry[]>();
  for (const e of entries) {
    let arr = byPos.get(e.position);
    if (!arr) {
      arr = [];
      byPos.set(e.position, arr);
    }
    arr.push(e);
  }
  const out = new Map<string, number>();
  for (const [, group] of byPos) {
    const vals = group.map((e) => e.value);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    for (const e of group) {
      out.set(e.playerId, sd > 0 ? (e.value - mean) / sd : 0);
    }
  }
  return out;
}

function weighted(parts: Array<[number | undefined, number]>): number | null {
  let totalWeight = 0;
  let sum = 0;
  for (const [val, w] of parts) {
    if (val !== undefined && Number.isFinite(val)) {
      sum += val * w;
      totalWeight += w;
    }
  }
  return totalWeight > 0 ? sum / totalWeight : null;
}

const MIN_GAMES = 6;

/**
 * Build EffScore composites for a pool of players.
 *
 * Returns a Map<playerId, effScore> where effScore is the raw composite
 * (z-score weighted sum, position-normalized). Returns null for players with
 * < MIN_GAMES games or no relevant data.
 *
 * Call getEffMultiplier(effScore) to convert to the WCS multiplier.
 */
export function computeEffScores(inputs: EffScoreInputs[]): Map<string, number | null> {
  const qualified = inputs.filter((p) => p.games >= MIN_GAMES);

  // Per-metric z-score maps by position.
  const buildZMap = (field: keyof EffScoreInputs): Map<string, number> =>
    zScoreMap(
      qualified
        .filter((p) => p[field] !== undefined && Number.isFinite(Number(p[field])))
        .map((p) => ({ playerId: p.playerId, position: p.position, value: Number(p[field]) })),
    );

  const zWopr = buildZMap("wopr");
  const zRouteRate = buildZMap("routeRate");
  const zYprr = buildZMap("yprr");
  const zTprr = buildZMap("tprr");
  const zADot = buildZMap("aDot");
  const zTargetShare = buildZMap("targetShare");
  const zWeightedOpp = buildZMap("weightedOpportunity");
  const zSnapPct = buildZMap("snapPct");
  const zYaco = buildZMap("yacoPerAtt");
  const zBT = buildZMap("brokenTacklesPerAtt");
  const zEpa = buildZMap("epaPerDropback");
  const zCpoe = buildZMap("cpoe");
  const zRushEpa = buildZMap("rushEpa");

  const result = new Map<string, number | null>();

  for (const p of inputs) {
    if (p.games < MIN_GAMES) {
      result.set(p.playerId, null);
      continue;
    }

    let score: number | null = null;
    const pos = p.position;

    if (pos === "WR") {
      score = weighted([
        [zWopr.get(p.playerId), 0.35],
        [zRouteRate.get(p.playerId), 0.25],
        [zYprr.get(p.playerId), 0.2],
        [zTprr.get(p.playerId), 0.15],
        [zADot.get(p.playerId), 0.05],
      ]);
    } else if (pos === "TE") {
      score = weighted([
        [zRouteRate.get(p.playerId), 0.3],
        [zTprr.get(p.playerId), 0.3],
        [zYprr.get(p.playerId), 0.2],
        [zTargetShare.get(p.playerId), 0.2],
      ]);
    } else if (pos === "RB") {
      score = weighted([
        [zWeightedOpp.get(p.playerId), 0.45],
        [zRouteRate.get(p.playerId), 0.25],
        [zSnapPct.get(p.playerId), 0.15],
        [zYaco.get(p.playerId), 0.1],
        [zBT.get(p.playerId), 0.05],
      ]);
    } else if (pos === "QB") {
      score = weighted([
        [zEpa.get(p.playerId), 0.5],
        [zCpoe.get(p.playerId), 0.3],
        [zRushEpa.get(p.playerId), 0.2],
      ]);
    }

    result.set(p.playerId, score);
  }

  return result;
}

/** Convert raw EffScore to a WCS multiplier clamped to [0.70, 1.30]. */
export function getEffMultiplier(effScore: number | null): number {
  if (effScore === null) return 1.0;
  return 1 + 0.15 * Math.max(-2, Math.min(2, effScore));
}

/**
 * Build EffScoreInputs from nflverse data maps.
 * Call this in the NflverseService resolver to prepare inputs for computeEffScores.
 */
export function buildEffScoreInputs(
  playerIds: string[],
  positions: Map<string, string>,
  playerStats: Map<string, NflversePlayerStats>,
  pfrStats: Map<string, NflversePfrStats>,
  ngsStats: Map<string, NflverseNgsStats>,
  ffOpp: Map<string, NflverseFfOpportunity>,
): EffScoreInputs[] {
  return playerIds.map((id) => {
    const stats = playerStats.get(id);
    const pfr = pfrStats.get(id);
    const ngs = ngsStats.get(id);
    const opp = ffOpp.get(id);
    const pos = positions.get(id) ?? "WR";
    const games = stats?.games ?? 0;
    const rushAtt = stats?.rushing_attempts ?? 0;

    return {
      playerId: id,
      position: pos,
      games,
      wopr: opp?.wopr_y ?? stats?.wopr,
      routeRate: pfr?.routes !== undefined && games > 0 ? pfr.routes / (games * 35) : undefined,
      yprr: pfr?.yprr,
      tprr: pfr?.tprr,
      aDot: ngs?.avg_intended_air_yards,
      targetShare: stats?.target_share,
      weightedOpportunity: opp?.weighted_opportunity,
      snapPct: stats?.snap_pct,
      yacoPerAtt: pfr?.yac_a,
      brokenTacklesPerAtt:
        pfr?.broken_tackles !== undefined && rushAtt > 0 ? pfr.broken_tackles / rushAtt : undefined,
      rushingAttempts: rushAtt,
      epaPerDropback: undefined, // EPA requires PBP — placeholder for Phase 2 PBP ETL
      cpoe: ngs?.cpoe,
      rushEpa: undefined, // placeholder
    };
  });
}
