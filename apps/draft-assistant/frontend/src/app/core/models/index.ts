export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface League {
  league_id: string;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete" | string;
  total_rosters: number;
  sport: string;
  settings: Record<string, unknown>;
  scoring_settings: Record<string, unknown>;
  roster_positions: string[];
  avatar: string | null;
}

export interface Roster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  reserve: string[] | null;
  picks: DraftPick[];
}

export interface Player {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  injury_status: string | null;
  college: string | null;
  rookie_year: number | null;
}

export interface DraftPick {
  season: string;
  round: number;
  roster_id: number;
  original_roster_id: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season?: string;
  status?: string;
  type?: string;
  start_time?: number;
  metadata?: Record<string, string>;
  settings?: Record<string, string | number | null>;
  slot_to_roster_id?: Record<string, number>;
  draft_order?: Record<string, number>;
}

export interface SleeperDraftPick {
  draft_id?: string;
  player_id: string;
  picked_by?: string | null;
  roster_id?: number | null;
  round: number;
  pick_no: number;
  draft_slot?: number | null;
  metadata?: Record<string, string>;
  is_keeper?: boolean;
}

export interface DraftPlayerRow {
  playerId: string;
  fullName: string;
  position: "QB" | "RB" | "WR" | "TE";
  team: string | null;
  age: number | null;
  /** Years of NFL experience from Sleeper catalog. 0 = rookie season. */
  yearsExp: number | null;
  rookie: boolean;
  ktcValue: number | null;
  ktcRank: number | null;
  ktcPositionalRank: number | null;
  overallTier: number | null;
  positionalTier: number | null;
  flockAverageTier: number | null;
  flockAveragePositionalTier: number | null;
  flockAveragePositionalRank: number | null;
  averageRank: number | null;
  sleeperRank: number;
  /** Sum of KTC overall tier + Flock average tier (lower = better). */
  combinedTier: number | null;
  /** Sum of KTC positional tier + Flock average positional tier (lower = better). */
  combinedPositionalTier: number | null;
  /** ADP rank (uses flockAverageRank as proxy for Sleeper ADP). */
  adpRank: number | null;
  /**
   * adpRank (flockAverageRank) minus average expert rank (sleeperRank + ktcRank) / 2.
   * flockAverageRank is excluded from the denominator to avoid circular logic.
   * Positive = value (community drafts later than experts rank). Negative = reach.
   */
  adpDelta: number | null;
  /**
   * max(ktcOverallTier, flockAverageTier) – min(ktcOverallTier, flockAverageTier).
   * 0 = full consensus, higher = more disagreement between sources.
   */
  valueGap: number | null;
  /** FantasyPros dynasty ADP rank (1QB or Superflex depending on league format). */
  fpAdpRank: number | null;
  /** FantasyCalc crowdsourced trade value (format-aware). */
  fantasyCalcValue: number | null;
  /** FantasyCalc 30-day value trend (signed delta in FC value units). */
  fantasyCalcTrend30Day: number | null;
  /** FantasyFootballCalculator mean ADP pick number (1-based). */
  adpMean: number | null;
  /** FantasyFootballCalculator ADP standard deviation in picks. */
  adpStd: number | null;
  /**
   * Consensus base value on a 0–100 scale, position-normalized via trimmed
   * z-mean of all available ranking sources. Higher = better. See
   * ConsensusAggregatorService.
   */
  baseValue: number | null;
  /**
   * Spread of source z-scores feeding baseValue (population sd). Higher =
   * sharper-vs-square divergence between rankers.
   */
  baseValueDivergence: number | null;
  /**
   * Probability the player is still on the board at the user's next pick,
   * estimated from ADP Normal(mean, std). 0–1.
   */
  pAvailAtNext: number | null;
  /**
   * Expected loss-of-waiting in baseValue units: probability the tier drains
   * before next pick × baseValue gap to the next tier.
   */
  tierCliffScore: number | null;
  /** Final Weighted Composite Score (Phase 1 simplified form); higher = better. */
  weightedCompositeScore: number | null;
}

export interface DraftRecommendation {
  playerId: string;
  fullName: string;
  position: "QB" | "RB" | "WR" | "TE";
  team: string | null;
  ktcValue: number | null;
  ktcRank: number | null;
  overallTier: number | null;
  positionalTier: number | null;
  flockAverageTier: number | null;
  flockAveragePositionalTier: number | null;
  averageRank: number | null;
  combinedTier: number | null;
  adpDelta: number | null;
  availabilityRisk: "safe" | "at-risk" | "gone";
  boostedScore: number;
}

export type TierLabel = "S" | "A" | "B" | "C" | "D";

export interface PlayerTier {
  player_id: string;
  tier: TierLabel;
}

export interface RankingValue {
  player_id: string;
  ktc_value: number | null;
  ktc_rank: number | null;
  sleeper_rank: number | null;
}

export interface LeagueRoster {
  roster_id: number;
  owner_id: string | null;
  league_id?: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi?: string[] | null;
  picks: DraftPick[] | null;
  settings: Record<string, number | string | null>;
}

export interface LeagueUser {
  user_id: string;
  display_name: string;
  username?: string | null;
  avatar?: string | null;
}

export interface SleeperCatalogPlayer {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  status?: string | null;
  active?: boolean | null;
  team?: string | null;
  age?: number | null;
  years_exp?: number | null;
  injury_status?: string | null;
  college?: string | null;
  rookie_year?: number | null;
}

export interface TeamViewPlayer {
  playerId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string;
  team: string | null;
  age: number | null;
  college: string | null;
  rookie: boolean;
  rookieYear: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;
  ktcValue: number | null;
  ktcRank: number | null;
  ktcPositionalRank: number | null;
  ktcOverallTier: number | null;
  ktcPositionalTier: number | null;
  sleeperRank: number | null;
  flockAverageTier: number | null;
  flockAveragePositionalTier: number | null;
  flockAveragePositionalRank: number | null;
  averageRank: number | null;
  combinedTier: number | null;
  combinedPositionalTier: number | null;
  adpRank: number | null;
  adpDelta: number | null;
  valueGap: number | null;
  fpAdpRank: number | null;
}

export interface TeamViewRating {
  combinedScore: number;
  positionScores: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  playerCount: number;
  source: "ktc" | "sleeper-fallback";
  ktcUnavailable: boolean;
}

export interface TeamViewRosterSections {
  starters: TeamViewPlayer[];
  bench: TeamViewPlayer[];
  ir: TeamViewPlayer[];
  futurePicks: DraftPick[];
}

export interface TeamViewRosterOption {
  rosterId: number;
  ownerId: string | null;
  ownerDisplayName: string;
}

export interface KtcPlayer {
  playerName: string;
  playerID: number;
  slug: string;
  position: string;
  positionID: number;
  team: string | null;
  rookie: boolean;
  age: number | null;
  value: number;
  rank: number;
  positionalRank: number;
  overallTier: number;
  positionalTier: number;
}

export interface FlockPlayer {
  playerName: string;
  position: string;
  team: string | null;
  averageRank: number | null;
  averageTier: number | null;
  averagePositionalRank: number | null;
  averagePositionalTier: number | null;
}

export interface FantasyProsPlayer {
  playerName: string;
  position: string;
  team: string | null;
  adpRank: number;
}

/** Slim FantasyCalc value entry (matches scripts/fetch-fantasycalc.mjs output). */
export interface FantasyCalcPlayer {
  playerName: string;
  sleeperId: string | null;
  position: string;
  value: number;
  overallRank: number | null;
  positionRank: number | null;
  trend30Day: number | null;
  redraftValue: number | null;
  combinedValue: number | null;
  /** Crowdsource value standard deviation (FC units). */
  stdev: number | null;
}

/** Slim FantasyFootballCalculator ADP entry (matches scripts/fetch-ffc-adp.mjs output). */
export interface FfcAdpPlayer {
  playerName: string;
  position: string;
  team: string | null;
  /** Mean ADP as a 1-based pick number. */
  adp: number;
  adpFormatted: string | null;
  /** Standard deviation of pick number across surveyed drafts. */
  stdev: number | null;
  high: number | null;
  low: number | null;
  timesDrafted: number | null;
  bye: number | null;
}

export type TierSource = "average" | "flock" | "ktc";

/** Season stat totals fetched from the Sleeper bulk weekly stats endpoint. */
export interface SleeperPlayerStats {
  pass_yd: number;
  pass_td: number;
  pass_int: number;
  pass_cmp: number;
  pass_att: number;
  rush_yd: number;
  rush_td: number;
  rush_att: number;
  rec_yd: number;
  rec_td: number;
  rec: number;
  tar: number;
  yac: number;
  rec_drop: number;
  /** Average snap participation rate (0–1) across weeks with snap data. */
  snap_pct: number;
}

/** Minimal player data required by PlayerCardComponent. */
export interface PlayerCardData {
  playerId: string;
  fullName: string;
  position: string;
  team: string | null;
  age: number | null;
  ktcRank: number | null;
  overallTier: number | null;
  flockAverageTier: number | null;
  combinedTier?: number | null;
  fpAdpRank?: number | null;
}

export interface LeagueStandingEntry {
  rosterId: number;
  ownerDisplayName: string;
  combinedScore: number;
  positionScores: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  rank: number;
}
