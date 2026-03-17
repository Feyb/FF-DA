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
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete' | string;
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
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | string;
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

export type TierLabel = 'S' | 'A' | 'B' | 'C' | 'D';

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
  yearsExp: number | null;
  injuryStatus: string | null;
  fallbackScore: number;
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
  source: 'ktc' | 'sleeper-fallback';
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
