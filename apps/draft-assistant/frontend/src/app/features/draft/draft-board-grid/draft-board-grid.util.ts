import {
  LeagueRoster,
  LeagueUser,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
} from "../../../core/models";
import { extractLastName } from "../../../core/utils/player-name.util";

export interface GridTeamHeader {
  slot: number;
  rosterId: number | null;
  displayName: string;
  avatarId: string | null;
  isMyTeam: boolean;
}

export interface GridCell {
  pickNo: number;
  round: number;
  /** Draft slot (1-based column position) */
  slot: number;
  /** Effective roster who holds this pick (after trades) */
  rosterId: number | null;
  /** Label shown in the cell, e.g. "1.01" or "2.10" */
  pickLabel: string;
  pick: SleeperDraftPick | null;
  playerLastName: string | null;
  playerId: string | null;
  /** Position string from pick metadata, e.g. "QB" */
  position: string | null;
  /** Overall tier from KTC / ranking data */
  overallTier: number | null;
  isCurrentPick: boolean;
  isMyTeam: boolean;
  /** True when this pick has been traded away from its original draft slot owner. */
  isTraded: boolean;
  /** Team name of the current holder when the pick is traded. */
  tradedToDisplayName: string | null;
}

export interface GridRow {
  round: number;
  cells: GridCell[];
  /** true → picks flow left-to-right this round, false → right-to-left */
  flowRight: boolean;
}

/**
 * Compute the overall pick number for a given (round, slot) in a draft.
 *
 * @param round  1-based round number
 * @param slot   1-based draft slot (column)
 * @param teams  total number of teams
 * @param linear true for rookie/linear drafts (always left→right)
 */
export const computePickNo = (
  round: number,
  slot: number,
  teams: number,
  linear: boolean,
): number => {
  if (linear || round % 2 === 1) {
    // Odd rounds and linear drafts: left-to-right
    return (round - 1) * teams + slot;
  }
  // Even rounds (snake): right-to-left
  return (round - 1) * teams + (teams - slot + 1);
};

/**
 * Given an overall pick number, derive the sequential position within its round (1-based).
 */
export const pickInRoundFromPickNo = (pickNo: number, teams: number): number =>
  ((pickNo - 1) % teams) + 1;

/**
 * Format a pick label, e.g. "2.07" for round 2, pick 7 in a 10-team draft.
 */
export const formatPickLabel = (round: number, pickNo: number, teams: number): string => {
  const within = pickInRoundFromPickNo(pickNo, teams);
  const width = String(teams).length;
  return `${round}.${String(within).padStart(width, "0")}`;
};

/**
 * Build team header objects for the grid.
 *
 * @param draft               Sleeper draft (for slot_to_roster_id, draft_order)
 * @param rosterDisplayNames  roster_id → display name
 * @param rosterAvatarIds     roster_id → Sleeper avatar ID
 * @param currentUserId       logged-in user ID (to mark "my team")
 */
export const buildGridHeaders = (
  draft: SleeperDraft,
  rosterDisplayNames: Record<string, string>,
  rosterAvatarIds: Record<string, string | null>,
  currentUserId: string | null,
): GridTeamHeader[] => {
  const teams = Number(draft.settings?.["teams"] ?? 0);
  if (!teams || teams <= 0) return [];

  const slotMap = draft.slot_to_roster_id ?? {};
  const mySlot = currentUserId != null ? (draft.draft_order?.[currentUserId] ?? null) : null;
  const myRawRosterId = mySlot != null ? (slotMap[String(mySlot)] ?? null) : null;
  const myRosterId = typeof myRawRosterId === "number" ? myRawRosterId : null;

  return Array.from({ length: teams }, (_, i) => {
    const slot = i + 1;
    const raw = slotMap[String(slot)];
    const rosterId = typeof raw === "number" ? raw : null;
    const key = rosterId !== null ? String(rosterId) : "";

    return {
      slot,
      rosterId,
      displayName: key && rosterDisplayNames[key] ? rosterDisplayNames[key] : `Slot ${slot}`,
      avatarId: key ? (rosterAvatarIds[key] ?? null) : null,
      isMyTeam: rosterId !== null && rosterId === myRosterId,
    };
  });
};

/**
 * Build the complete grid row/cell structure for the draft board.
 *
 * @param draft               Sleeper draft metadata
 * @param picks               Normalized completed picks
 * @param playerNameMap       player_id → full name
 * @param tierByPlayerId      player_id → overall tier (optional, pass empty map if unavailable)
 * @param currentUserId       logged-in user's Sleeper user_id
 * @param tradedPicks         Traded picks from the Sleeper traded_picks endpoint
 */
export const buildGridRows = (
  draft: SleeperDraft,
  picks: SleeperDraftPick[],
  playerNameMap: Record<string, string>,
  tierByPlayerId: Map<string, number | null>,
  currentUserId: string | null,
  tradedPicks: SleeperTradedPick[] = [],
  rosterDisplayNames: Record<string, string> = {},
): GridRow[] => {
  const teams = Number(draft.settings?.["teams"] ?? 0);
  const rounds = Number(draft.settings?.["rounds"] ?? 0);
  if (teams <= 0 || rounds <= 0) return [];

  const isLinear = (draft.type ?? "").toLowerCase() === "linear";
  const slotMap = draft.slot_to_roster_id ?? {};

  // Resolve the current user's roster_id via their draft slot
  const mySlot = currentUserId != null ? (draft.draft_order?.[currentUserId] ?? null) : null;
  const myRawRosterId = mySlot != null ? (slotMap[String(mySlot)] ?? null) : null;
  const myRosterId = typeof myRawRosterId === "number" ? myRawRosterId : null;

  const nextPickNo = picks.length + 1;
  const rosterDisplayNameForId = (rosterId: number): string =>
    rosterDisplayNames[String(rosterId)] ?? `Roster ${rosterId}`;

  const picksByNo = new Map<number, SleeperDraftPick>();
  for (const p of picks) {
    picksByNo.set(p.pick_no, p);
  }

  // Build traded-pick lookup maps keyed by "round-originalRosterId".
  const tradedPickKeys = new Set<string>();
  const tradedPickOwnerByKey = new Map<string, number>();
  for (const tp of tradedPicks) {
    const key = `${tp.round}-${tp.roster_id}`;
    tradedPickKeys.add(key);
    tradedPickOwnerByKey.set(key, tp.owner_id);
  }

  return Array.from({ length: rounds }, (_, ri) => {
    const round = ri + 1;
    const flowRight = isLinear || round % 2 === 1;

    const cells: GridCell[] = Array.from({ length: teams }, (__, ci) => {
      const slot = ci + 1;
      const pickNo = computePickNo(round, slot, teams, isLinear);
      const rawRid = slotMap[String(slot)];
      const slotRosterId = typeof rawRid === "number" ? rawRid : null;
      const tradedKey = slotRosterId !== null ? `${round}-${slotRosterId}` : null;
      const tradedOwnerId = tradedKey ? (tradedPickOwnerByKey.get(tradedKey) ?? null) : null;

      const draftedPick = picksByNo.get(pickNo) ?? null;
      // For traded picks the pick's own roster_id takes precedence
      const effectiveRosterId = draftedPick?.roster_id ?? tradedOwnerId ?? slotRosterId;

      const playerId = draftedPick?.player_id ?? null;
      const position = draftedPick?.metadata?.["position"] ?? null;

      const lastName: string | null =
        draftedPick?.metadata?.["last_name"] ??
        (playerId ? extractLastName(playerNameMap[playerId] ?? "") : null);

      const tier = playerId ? (tierByPlayerId.get(playerId) ?? null) : null;
      const pickLabel = formatPickLabel(round, pickNo, teams);

      // A pick is traded if it appears in the traded_picks endpoint (keyed by round + original roster)
      // or if the drafted pick's current roster differs from the original slot owner.
      const isTraded =
        (tradedKey !== null && tradedPickKeys.has(tradedKey)) ||
        (draftedPick !== null &&
          slotRosterId !== null &&
          draftedPick.roster_id !== null &&
          draftedPick.roster_id !== slotRosterId);
      const tradedToDisplayName =
        isTraded && effectiveRosterId !== null && effectiveRosterId !== slotRosterId
          ? rosterDisplayNameForId(effectiveRosterId)
          : null;

      return {
        pickNo,
        round,
        slot,
        rosterId: effectiveRosterId,
        pickLabel,
        pick: draftedPick,
        playerLastName: lastName,
        playerId,
        position,
        overallTier: tier,
        isCurrentPick: pickNo === nextPickNo,
        isMyTeam: effectiveRosterId !== null && effectiveRosterId === myRosterId,
        isTraded,
        tradedToDisplayName,
      };
    });

    return { round, cells, flowRight };
  });
};

/**
 * Build a `rosterAvatarIds` map from rosters + users array (same pattern as rosterDisplayNames).
 */
export const mapRosterAvatarIds = (
  rosters: LeagueRoster[],
  users: LeagueUser[],
): Record<string, string | null> => {
  const usersById = users.reduce<Record<string, LeagueUser>>((acc, user) => {
    acc[user.user_id] = user;
    return acc;
  }, {});

  return rosters.reduce<Record<string, string | null>>((acc, roster) => {
    const ownerId = roster.owner_id ?? "";
    const user = ownerId ? usersById[ownerId] : undefined;
    acc[String(roster.roster_id)] = user?.avatar ?? null;
    return acc;
  }, {});
};
