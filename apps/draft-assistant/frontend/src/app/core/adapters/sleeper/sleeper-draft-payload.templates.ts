import { SleeperDraft } from '../../models';

export const SLEEPER_DRAFT_PLAYER_TYPE = {
  ALL_PLAYERS: 0,
  ROOKIES_ONLY: 1,
} as const;

export interface SleeperDraftSettingsTemplate {
  player_type?: number | string | null;
  rounds?: number | string | null;
  teams?: number | string | null;
  [key: string]: number | string | null | undefined;
}

export interface SleeperDraftMetadataTemplate {
  name?: string;
  type?: string;
  [key: string]: string | undefined;
}

export type SleeperDraftTemplate = Omit<SleeperDraft, 'settings' | 'metadata'> & {
  settings?: SleeperDraftSettingsTemplate;
  metadata?: SleeperDraftMetadataTemplate;
};

// Example payload mirrors Sleeper docs and observed mock-draft responses.
export const SLEEPER_DRAFT_TEMPLATE_EXAMPLE: SleeperDraftTemplate = {
  draft_id: '1338981448228569088',
  league_id: '',
  season: '2026',
  status: 'drafting',
  type: 'league_mock',
  metadata: {
    name: 'Mock Draft',
    type: 'rookie',
  },
  settings: {
    player_type: SLEEPER_DRAFT_PLAYER_TYPE.ROOKIES_ONLY,
    rounds: 5,
    teams: 12,
  },
  slot_to_roster_id: {
    '1': 1,
  },
};
