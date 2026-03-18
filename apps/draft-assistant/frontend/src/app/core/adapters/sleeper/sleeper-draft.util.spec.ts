import {
  extractSleeperDraftId,
  getSleeperDraftNameLabel,
  getSleeperDraftPresentation,
  getSleeperDraftScoringLabel,
  getSleeperDraftStatusLabel,
  getSleeperDraftTypeLabel,
  getSleeperUserDraftPosition,
  isSleeperRookieDraft,
} from './sleeper-draft.util';
import { SLEEPER_DRAFT_PLAYER_TYPE } from './sleeper-draft-payload.templates';

describe('sleeper-draft.util', () => {
  describe('extractSleeperDraftId', () => {
    it('parses a direct draft id', () => {
      expect(extractSleeperDraftId('1338981448228569088')).toBe('1338981448228569088');
    });

    it('parses a Sleeper draft URL', () => {
      expect(extractSleeperDraftId('https://sleeper.com/draft/nfl/1338981448228569088')).toBe('1338981448228569088');
    });

    it('returns null for unsupported input', () => {
      expect(extractSleeperDraftId('https://sleeper.com/leagues/123')).toBeNull();
    });
  });

  describe('isSleeperRookieDraft', () => {
    it('prioritizes settings.player_type', () => {
      expect(
        isSleeperRookieDraft({
          draft_id: '1',
          league_id: '',
          settings: { player_type: SLEEPER_DRAFT_PLAYER_TYPE.ROOKIES_ONLY },
        }),
      ).toBeTrue();
    });

    it('detects rookie metadata when player_type is absent', () => {
      expect(
        isSleeperRookieDraft({
          draft_id: '1',
          league_id: '',
          metadata: { name: '2026 Rookie Mock' },
        }),
      ).toBeTrue();
    });

    it('returns false for all-player drafts', () => {
      expect(
        isSleeperRookieDraft({
          draft_id: '1',
          league_id: '',
          type: 'league_mock',
          settings: { player_type: SLEEPER_DRAFT_PLAYER_TYPE.ALL_PLAYERS },
        }),
      ).toBeFalse();
    });
  });

  describe('draft presentation normalization', () => {
    it('prefers metadata name and metadata type labels when available', () => {
      const draft = {
        draft_id: '1',
        league_id: '2',
        status: 'pre_draft',
        type: 'league_mock',
        metadata: {
          name: 'SleeperTierSite Imported Rookie Mock',
          type: 'rookie',
        },
      };

      expect(getSleeperDraftNameLabel(draft)).toBe('SleeperTierSite Imported Rookie Mock');
      expect(getSleeperDraftTypeLabel(draft)).toBe('Rookie');
      expect(getSleeperDraftStatusLabel(draft)).toBe('Pre Draft');
    });

    it('falls back to formatted draft type when metadata is absent', () => {
      const draft = {
        draft_id: '1',
        league_id: '2',
        type: 'league_mock',
      };

      expect(getSleeperDraftNameLabel(draft)).toBe('League Mock');
      expect(getSleeperDraftTypeLabel(draft)).toBe('League Mock');
    });

    it('derives scoring from metadata before league format', () => {
      const draft = {
        draft_id: '1',
        league_id: '2',
        metadata: {
          scoring_type: 'auction_superflex',
        },
      };

      expect(
        getSleeperDraftScoringLabel(draft, {
          league_id: '2',
          name: 'League',
          season: '2026',
          status: 'pre_draft',
          total_rosters: 12,
          sport: 'nfl',
          settings: {},
          scoring_settings: {},
          roster_positions: ['QB'],
          avatar: null,
        }),
      ).toBe('Auction Superflex');
    });

    it('falls back to league format for scoring when draft metadata is absent', () => {
      const draft = {
        draft_id: '1',
        league_id: '2',
      };

      expect(
        getSleeperDraftScoringLabel(draft, {
          league_id: '2',
          name: 'League',
          season: '2026',
          status: 'pre_draft',
          total_rosters: 12,
          sport: 'nfl',
          settings: {},
          scoring_settings: {},
          roster_positions: ['QB', 'RB', 'WR', 'TE', 'SUPER_FLEX'],
          avatar: null,
        }),
      ).toBe('Superflex');
    });

    it('builds a consistent combined presentation object', () => {
      expect(
        getSleeperDraftPresentation(
          {
            draft_id: '1',
            league_id: '2',
            status: 'drafting',
            type: 'league_mock',
            metadata: {
              name: 'Imported Mock',
              type: 'rookie',
            },
          },
          null,
        ),
      ).toEqual({
        name: 'Imported Mock',
        type: 'Rookie',
        status: 'Drafting',
        scoring: 'Unknown',
      });
    });
  });

  describe('getSleeperUserDraftPosition', () => {
    it('computes first-round draft position from numeric draft_order entry', () => {
      expect(
        getSleeperUserDraftPosition(
          {
            draft_id: '1',
            league_id: '2',
            settings: { teams: 12 },
            draft_order: { user123: 8 },
          },
          'user123',
        ),
      ).toEqual({
        slot: 8,
        firstRoundPick: 8,
        label: '1.08',
      });
    });

    it('accepts string draft_order values and falls back when teams is unavailable', () => {
      expect(
        getSleeperUserDraftPosition(
          {
            draft_id: '1',
            league_id: '2',
            draft_order: { user123: '4' as unknown as number },
          },
          'user123',
        ),
      ).toEqual({
        slot: 4,
        firstRoundPick: 4,
        label: 'Slot 4',
      });
    });

    it('returns null when selected user does not exist in draft_order', () => {
      expect(
        getSleeperUserDraftPosition(
          {
            draft_id: '1',
            league_id: '2',
            draft_order: { otherUser: 3 },
          },
          'user123',
        ),
      ).toBeNull();
    });
  });
});
