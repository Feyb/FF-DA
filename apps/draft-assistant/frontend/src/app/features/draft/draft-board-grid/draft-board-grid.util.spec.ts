import {
  buildGridHeaders,
  buildGridRows,
  computePickNo,
  formatPickLabel,
  mapRosterAvatarIds,
  pickInRoundFromPickNo,
} from './draft-board-grid.util';
import { LeagueRoster, LeagueUser, SleeperDraftPick } from '../../../core/models';

describe('draft-board-grid.util', () => {
  // ------------------------------------------------------------------ //
  // computePickNo
  // ------------------------------------------------------------------ //
  describe('computePickNo', () => {
    describe('snake draft (linear = false)', () => {
      it('round 1 goes left-to-right: slot 1 → pick 1', () => {
        expect(computePickNo(1, 1, 10, false)).toBe(1);
      });

      it('round 1 goes left-to-right: slot 10 → pick 10', () => {
        expect(computePickNo(1, 10, 10, false)).toBe(10);
      });

      it('round 2 goes right-to-left: slot 10 → pick 11 (first pick of round 2)', () => {
        expect(computePickNo(2, 10, 10, false)).toBe(11);
      });

      it('round 2 goes right-to-left: slot 1 → pick 20 (last pick of round 2)', () => {
        expect(computePickNo(2, 1, 10, false)).toBe(20);
      });

      it('round 3 goes left-to-right again: slot 1 → pick 21', () => {
        expect(computePickNo(3, 1, 10, false)).toBe(21);
      });

      it('handles a 12-team draft', () => {
        // Round 2, slot 12 → first pick of round 2 = pick 13
        expect(computePickNo(2, 12, 12, false)).toBe(13);
        // Round 2, slot 1 → last pick of round 2 = pick 24
        expect(computePickNo(2, 1, 12, false)).toBe(24);
      });
    });

    describe('linear / rookie draft', () => {
      it('all rounds go left-to-right: round 2 slot 10 → pick 20', () => {
        expect(computePickNo(2, 10, 10, true)).toBe(20);
      });

      it('round 2 slot 1 → pick 11', () => {
        expect(computePickNo(2, 1, 10, true)).toBe(11);
      });
    });
  });

  // ------------------------------------------------------------------ //
  // pickInRoundFromPickNo
  // ------------------------------------------------------------------ //
  describe('pickInRoundFromPickNo', () => {
    it('pick 1 in a 10-team draft → position 1', () => {
      expect(pickInRoundFromPickNo(1, 10)).toBe(1);
    });

    it('pick 10 in a 10-team draft → position 10', () => {
      expect(pickInRoundFromPickNo(10, 10)).toBe(10);
    });

    it('pick 11 in a 10-team draft → position 1 (start of round 2)', () => {
      expect(pickInRoundFromPickNo(11, 10)).toBe(1);
    });

    it('pick 20 in a 10-team draft → position 10 (end of round 2)', () => {
      expect(pickInRoundFromPickNo(20, 10)).toBe(10);
    });
  });

  // ------------------------------------------------------------------ //
  // formatPickLabel
  // ------------------------------------------------------------------ //
  describe('formatPickLabel', () => {
    it('formats "1.01" for round 1, pick 1 in a 10-team draft', () => {
      expect(formatPickLabel(1, 1, 10)).toBe('1.01');
    });

    it('formats "2.01" for the first pick of round 2 (pick 11)', () => {
      // In snake round 2, slot 10 has pickNo=11 → within-round position = 1
      expect(formatPickLabel(2, 11, 10)).toBe('2.01');
    });

    it('formats "4.3" style for single-digit teams', () => {
      // 4-team draft, round 1, pick 3 → "1.3"
      expect(formatPickLabel(1, 3, 4)).toBe('1.3');
    });
  });

  // ------------------------------------------------------------------ //
  // buildGridHeaders
  // ------------------------------------------------------------------ //
  describe('buildGridHeaders', () => {
    const baseDraft = {
      draft_id: 'd1',
      league_id: 'l1',
      settings: { teams: 2 },
      slot_to_roster_id: { '1': 10, '2': 20 },
      draft_order: { userA: 1, userB: 2 },
    };

    it('returns one header per team slot', () => {
      const headers = buildGridHeaders(baseDraft, {}, {}, null);
      expect(headers.length).toBe(2);
    });

    it('uses display name from rosterDisplayNames', () => {
      const headers = buildGridHeaders(baseDraft, { '10': 'Alice', '20': 'Bob' }, {}, null);
      expect(headers[0].displayName).toBe('Alice');
      expect(headers[1].displayName).toBe('Bob');
    });

    it('falls back to "Slot N" when display name is missing', () => {
      const headers = buildGridHeaders(baseDraft, {}, {}, null);
      expect(headers[0].displayName).toBe('Slot 1');
    });

    it('marks the correct header as isMyTeam when currentUserId matches', () => {
      const headers = buildGridHeaders(baseDraft, {}, {}, 'userA');
      expect(headers[0].isMyTeam).toBeTrue();
      expect(headers[1].isMyTeam).toBeFalse();
    });

    it('includes avatarId from rosterAvatarIds', () => {
      const headers = buildGridHeaders(baseDraft, {}, { '10': 'abc123' }, null);
      expect(headers[0].avatarId).toBe('abc123');
      expect(headers[1].avatarId).toBeNull();
    });

    it('returns empty array when settings.teams is 0', () => {
      const draft = { ...baseDraft, settings: { teams: 0 } };
      expect(buildGridHeaders(draft, {}, {}, null)).toEqual([]);
    });
  });

  // ------------------------------------------------------------------ //
  // buildGridRows
  // ------------------------------------------------------------------ //
  describe('buildGridRows', () => {
    const baseDraft = {
      draft_id: 'd1',
      league_id: 'l1',
      type: 'snake',
      settings: { teams: 2, rounds: 2 },
      slot_to_roster_id: { '1': 10, '2': 20 },
      draft_order: { userA: 1, userB: 20 },
    };

    it('returns 2 rows for a 2-round draft', () => {
      const rows = buildGridRows(baseDraft, [], {}, new Map(), null);
      expect(rows.length).toBe(2);
    });

    it('each row has a cell per team', () => {
      const rows = buildGridRows(baseDraft, [], {}, new Map(), null);
      expect(rows[0].cells.length).toBe(2);
      expect(rows[1].cells.length).toBe(2);
    });

    it('round 1 flows right, round 2 flows left for snake', () => {
      const rows = buildGridRows(baseDraft, [], {}, new Map(), null);
      expect(rows[0].flowRight).toBeTrue();
      expect(rows[1].flowRight).toBeFalse();
    });

    it('all rounds flow right for linear drafts', () => {
      const linearDraft = { ...baseDraft, type: 'linear' };
      const rows = buildGridRows(linearDraft, [], {}, new Map(), null);
      expect(rows[0].flowRight).toBeTrue();
      expect(rows[1].flowRight).toBeTrue();
    });

    it('assigns correct pick numbers to cells', () => {
      const rows = buildGridRows(baseDraft, [], {}, new Map(), null);
      // Round 1: slot 1 → pick 1, slot 2 → pick 2
      expect(rows[0].cells[0].pickNo).toBe(1);
      expect(rows[0].cells[1].pickNo).toBe(2);
      // Round 2 snake: slot 1 → pick 4 (last), slot 2 → pick 3 (first)
      expect(rows[1].cells[0].pickNo).toBe(4);
      expect(rows[1].cells[1].pickNo).toBe(3);
    });

    it('populates pick cell from picks array', () => {
      const pick: SleeperDraftPick = {
        pick_no: 1,
        round: 1,
        player_id: 'p123',
        roster_id: 10,
        metadata: { position: 'QB', last_name: 'Mahomes' },
      };
      const rows = buildGridRows(baseDraft, [pick], {}, new Map(), null);
      const cell = rows[0].cells[0];
      expect(cell.pick).toEqual(pick);
      expect(cell.position).toBe('QB');
      expect(cell.playerLastName).toBe('Mahomes');
    });

    it('falls back to playerNameMap for last name when metadata is absent', () => {
      const pick: SleeperDraftPick = {
        pick_no: 1,
        round: 1,
        player_id: 'p123',
        roster_id: 10,
      };
      const rows = buildGridRows(baseDraft, [pick], { p123: 'Patrick Mahomes' }, new Map(), null);
      expect(rows[0].cells[0].playerLastName).toBe('Mahomes');
    });

    it('marks the current pick cell', () => {
      // No picks yet, so pick #1 is the current pick
      const rows = buildGridRows(baseDraft, [], {}, new Map(), null);
      expect(rows[0].cells[0].isCurrentPick).toBeTrue();
      expect(rows[0].cells[1].isCurrentPick).toBeFalse();
    });

    it('marks my-team cells when currentUserId is provided', () => {
      const rows = buildGridRows(baseDraft, [], {}, new Map(), 'userA');
      // userA → slot 1 → rosterId 10; column 0 (slot 1) is my team
      expect(rows[0].cells[0].isMyTeam).toBeTrue();
      expect(rows[0].cells[1].isMyTeam).toBeFalse();
    });

    it('returns empty when teams or rounds are 0', () => {
      const emptyDraft = { ...baseDraft, settings: { teams: 0, rounds: 0 } };
      expect(buildGridRows(emptyDraft, [], {}, new Map(), null)).toEqual([]);
    });
  });

  // ------------------------------------------------------------------ //
  // mapRosterAvatarIds
  // ------------------------------------------------------------------ //
  describe('mapRosterAvatarIds', () => {
    const rosters: LeagueRoster[] = [
      {
        roster_id: 1,
        owner_id: 'u1',
        players: [],
        starters: [],
        reserve: null,
        picks: null,
        settings: {},
      },
      {
        roster_id: 2,
        owner_id: null,
        players: [],
        starters: [],
        reserve: null,
        picks: null,
        settings: {},
      },
    ];

    const users: LeagueUser[] = [
      { user_id: 'u1', display_name: 'Alice', avatar: 'avt1' },
    ];

    it('maps roster_id to avatar when user has avatar', () => {
      const result = mapRosterAvatarIds(rosters, users);
      expect(result['1']).toBe('avt1');
    });

    it('maps null when roster has no owner', () => {
      const result = mapRosterAvatarIds(rosters, users);
      expect(result['2']).toBeNull();
    });

    it('maps null when user has no avatar', () => {
      const usersNoAvatar: LeagueUser[] = [
        { user_id: 'u1', display_name: 'Alice', avatar: undefined },
      ];
      const result = mapRosterAvatarIds(rosters, usersNoAvatar);
      expect(result['1']).toBeNull();
    });
  });
});
