import { isSleeperRookieDraft, extractSleeperDraftId } from './sleeper-draft.util';
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
});
