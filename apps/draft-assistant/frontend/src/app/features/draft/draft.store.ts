import { computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { forkJoin, firstValueFrom } from 'rxjs';
import { KtcRatingService } from '../../core/adapters/ktc/ktc-rating.service';
import { isSleeperRookieDraft } from '../../core/adapters/sleeper/sleeper-draft.util';
import { SleeperService } from '../../core/adapters/sleeper/sleeper.service';
import {
  DraftPlayerRow,
  DraftRecommendation,
  DraftTeamHistoryEntry,
  KtcPlayer,
  LeagueRoster,
  LeagueUser,
  SleeperCatalogPlayer,
  SleeperDraft,
  SleeperDraftPick,
} from '../../core/models';
import { AppStore } from '../../core/state/app.store';

export type DraftPositionFilter = 'QB' | 'RB' | 'WR' | 'TE';
export type DraftSourceMode = 'league' | 'direct';

interface SelectDraftOptions {
  rookieHint?: boolean;
  source?: DraftSourceMode;
}

interface DraftState {
  loading: boolean;
  error: string | null;
  staleData: boolean;
  selectedLeagueId: string | null;
  draftSource: DraftSourceMode | null;
  drafts: SleeperDraft[];
  selectedDraftId: string | null;
  draftStatus: string | null;
  rosterDisplayNames: Record<string, string>;
  playerNameMap: Record<string, string>;
  picks: SleeperDraftPick[];
  rows: DraftPlayerRow[];
  selectedPositions: DraftPositionFilter[];
  rookiesOnly: boolean;
  starredPlayerIds: string[];
  lastUpdatedAt: number | null;
}

const DEFAULT_POSITIONS: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];

export const DraftStore = signalStore(
  withState<DraftState>({
    loading: false,
    error: null,
    staleData: false,
    selectedLeagueId: null,
    draftSource: null,
    drafts: [],
    selectedDraftId: null,
    draftStatus: null,
    rosterDisplayNames: {},
    playerNameMap: {},
    picks: [],
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    starredPlayerIds: [],
    lastUpdatedAt: null,
  }),
  withComputed((store) => ({
    // Lower tier number means higher tier quality; convert it into a positive value bonus.
    // This intentionally nudges recommendations toward premium tiers without ignoring KTC value.
    selectedDraft: computed(() => store.drafts().find((d) => d.draft_id === store.selectedDraftId()) ?? null),
    pickedPlayerIds: computed(() => {
      const ids = new Set<string>();
      for (const pick of store.picks()) {
        if (pick.player_id) {
          ids.add(pick.player_id);
        }
      }
      return ids;
    }),
    availableRows: computed(() => {
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store.picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      return store.rows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .sort((a, b) => {
          const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });
    }),
    recommendations: computed(() => {
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store.picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      const tierBonus = (overallTier: number | null, positionalTier: number | null): number => {
        const tier = overallTier ?? positionalTier;
        if (tier === null) {
          return 0;
        }

        return Math.max(0, 12 - tier) * 250;
      };

      const normalizedTier = (overallTier: number | null, positionalTier: number | null): number =>
        positionalTier ?? overallTier ?? Number.MAX_SAFE_INTEGER;

      const positionOrder: Record<DraftPositionFilter, number> = {
        QB: 0,
        RB: 1,
        WR: 2,
        TE: 3,
      };

      const sortedRows = store.rows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .sort((a, b) => {
          const aTier = normalizedTier(a.overallTier, a.positionalTier);
          const bTier = normalizedTier(b.overallTier, b.positionalTier);
          if (aTier !== bTier) return aTier - bTier;

          const aPosition = positionOrder[a.position];
          const bPosition = positionOrder[b.position];
          if (aPosition !== bPosition) return aPosition - bPosition;

          const aBoosted = (a.ktcValue ?? 0) + tierBonus(a.overallTier, a.positionalTier);
          const bBoosted = (b.ktcValue ?? 0) + tierBonus(b.overallTier, b.positionalTier);
          if (aBoosted !== bBoosted) return bBoosted - aBoosted;

          const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });

      // Find top 3 distinct tier values
      const tierOrder: number[] = [];
      const seenTiers = new Set<number>();
      for (const row of sortedRows) {
        const tier = normalizedTier(row.overallTier, row.positionalTier);
        if (!seenTiers.has(tier)) {
          tierOrder.push(tier);
          seenTiers.add(tier);
        }
      }
      const top3Tiers = new Set(tierOrder.slice(0, 3));

      // Filter to top 3 tiers and cap at 3 players per tier
      const tierPlayerCounts = new Map<number, number>();
      const filtered = sortedRows.filter((row) => {
        const tier = normalizedTier(row.overallTier, row.positionalTier);
        if (!top3Tiers.has(tier)) {
          return false;
        }
        const count = tierPlayerCounts.get(tier) ?? 0;
        if (count >= 3) {
          return false;
        }
        tierPlayerCounts.set(tier, count + 1);
        return true;
      });

      return filtered.map<DraftRecommendation>((row) => ({
          boostedScore:
            (row.ktcValue ?? 0) +
            tierBonus(row.overallTier, row.positionalTier),
          playerId: row.playerId,
          fullName: row.fullName,
          position: row.position,
          team: row.team,
          ktcValue: row.ktcValue,
          ktcRank: row.ktcRank,
          overallTier: row.overallTier,
          positionalTier: row.positionalTier,
        }));
    }),
    starredRows: computed(() => {
      const stars = new Set(store.starredPlayerIds());
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store.picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      return store.rows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .filter((row) => stars.has(row.playerId))
        .sort((a, b) => {
          const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });
    }),
    pickBoard: computed(() => [...store.picks()].sort((a, b) => a.pick_no - b.pick_no)),
    recentPicks: computed(() => [...store.picks()].sort((a, b) => b.pick_no - a.pick_no).slice(0, 10)),
    teamHistory: computed(() => {
      const grouped = new Map<number, SleeperDraftPick[]>();
      for (const pick of store.picks()) {
        const rosterId = pick.roster_id ?? 0;
        if (!grouped.has(rosterId)) {
          grouped.set(rosterId, []);
        }
        grouped.get(rosterId)?.push(pick);
      }

      const history: DraftTeamHistoryEntry[] = [];
      for (const [rosterId, picks] of grouped.entries()) {
        history.push({
          rosterId,
          ownerDisplayName: store.rosterDisplayNames()[String(rosterId)] ?? `Roster ${rosterId}`,
          picks: [...picks].sort((a, b) => a.pick_no - b.pick_no),
        });
      }

      return history.sort((a, b) => a.rosterId - b.rosterId);
    }),
    nextPickNumber: computed(() => store.picks().length + 1),
  })),
  withMethods((store, appStore = inject(AppStore), sleeper = inject(SleeperService), ktc = inject(KtcRatingService)) => {
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let refreshInFlight = false;

    const selectedDraftStorageKey = (leagueId: string): string => `draftAssistant.selectedDraft.${leagueId}`;
    const starStorageKey = (leagueId: string): string => `draftAssistant.draftStars.${leagueId}`;

    const stopPolling = (): void => {
      if (pollHandle !== null) {
        clearInterval(pollHandle);
        pollHandle = null;
      }
    };

    const maybeStartPolling = (): void => {
      const selectedDraftId = store.selectedDraftId();
      const status = store.draftStatus();
      if (!selectedDraftId || status !== 'drafting') {
        stopPolling();
        return;
      }

      if (pollHandle !== null) {
        return;
      }

      pollHandle = setInterval(() => {
        void refreshDraft();
      }, 1000);
    };

    const mapRosterDisplayNames = (rosters: LeagueRoster[], users: LeagueUser[]): Record<string, string> => {
      const usersById = users.reduce<Record<string, LeagueUser>>((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {});

      return rosters.reduce<Record<string, string>>((acc, roster) => {
        const ownerId = roster.owner_id ?? '';
        const user = ownerId ? usersById[ownerId] : undefined;
        acc[String(roster.roster_id)] = user?.display_name ?? `Roster ${roster.roster_id}`;
        return acc;
      }, {});
    };

    const isActiveSleeperPlayer = (source: SleeperCatalogPlayer): boolean => {
      if (source.active === false) return false;
      const status = source.status?.toLowerCase().trim();
      if (!status) return true;
      return status === 'active';
    };

    const mapRows = (
      playersById: Record<string, SleeperCatalogPlayer>,
      ktcLookup: Map<string, KtcPlayer>,
      currentSeason: number,
    ): DraftPlayerRow[] => {
      const rawRows: Omit<DraftPlayerRow, 'sleeperRank'>[] = Object.entries(playersById)
        .filter(([, source]) => isActiveSleeperPlayer(source))
        .map(([playerId, source]) => {
          const firstName = source.first_name ?? '';
          const lastName = source.last_name ?? '';
          const fullName = source.full_name?.trim() || `${firstName} ${lastName}`.trim();
          const position = (source.position ?? '') as DraftPositionFilter;
          const ktcPlayer = ktcLookup.get(ktc.normalizeName(fullName));

          return {
            playerId,
            fullName,
            position,
            team: source.team ?? null,
            age: source.age ?? null,
            rookie: ktcPlayer?.rookie ?? source.rookie_year === currentSeason,
            ktcValue: ktcPlayer?.value ?? null,
            ktcRank: ktcPlayer?.rank ?? null,
            overallTier: ktcPlayer?.overallTier ?? null,
            positionalTier: ktcPlayer?.positionalTier ?? null,
          };
        })
        .filter((row) => row.fullName.length > 0)
        .filter((row) => DEFAULT_POSITIONS.includes(row.position))
        .filter((row) => row.team !== null || row.rookie);

      const sleeperSorted = [...rawRows].sort((a, b) => {
        const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
        const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
      });

      const sleeperRankMap = new Map<string, number>();
      for (let i = 0; i < sleeperSorted.length; i++) {
        sleeperRankMap.set(sleeperSorted[i].playerId, i + 1);
      }

      return rawRows.map((row) => ({
        ...row,
        sleeperRank: sleeperRankMap.get(row.playerId) ?? Number.MAX_SAFE_INTEGER,
      }));
    };

    const normalizePicks = (draft: SleeperDraft, picks: SleeperDraftPick[]): SleeperDraftPick[] => {
      const slotMap = draft.slot_to_roster_id ?? {};

      return picks
        .filter((pick) => !!pick.player_id)
        .map((pick) => {
          const slot = pick.draft_slot ?? null;
          const mappedRosterId = slot !== null ? slotMap[String(slot)] : undefined;
          const rosterId = pick.roster_id ?? mappedRosterId ?? null;
          return {
            ...pick,
            roster_id: rosterId,
          };
        })
        .sort((a, b) => a.pick_no - b.pick_no);
    };

    const chooseDraftId = (leagueId: string, drafts: SleeperDraft[]): string | null => {
      let savedDraftId: string | null = null;
      try {
        savedDraftId = localStorage.getItem(selectedDraftStorageKey(leagueId));
      } catch {
        savedDraftId = null;
      }

      if (savedDraftId && drafts.some((draft) => draft.draft_id === savedDraftId)) {
        return savedDraftId;
      }

      const drafting = drafts.find((draft) => draft.status === 'drafting');
      if (drafting) {
        return drafting.draft_id;
      }

      const sorted = [...drafts].sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));
      return sorted[0]?.draft_id ?? null;
    };

    const upsertDraft = (drafts: SleeperDraft[], draft: SleeperDraft): SleeperDraft[] => {
      const hasDraft = drafts.some((existing) => existing.draft_id === draft.draft_id);
      if (!hasDraft) {
        return [draft, ...drafts];
      }

      return drafts.map((existing) =>
        existing.draft_id === draft.draft_id ? draft : existing,
      );
    };

    const loadStarredPlayerIds = (leagueId: string | null): string[] => {
      if (!leagueId) {
        return [];
      }

      try {
        const raw = localStorage.getItem(starStorageKey(leagueId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const loadDraftContext = async (
      draft: SleeperDraft,
      fallbackLeagueId: string | null,
    ): Promise<{
      selectedLeagueId: string | null;
      rosterDisplayNames: Record<string, string>;
      playerNameMap: Record<string, string>;
      rows: DraftPlayerRow[];
      starredPlayerIds: string[];
    }> => {
      const selectedLeague = appStore.selectedLeague();
      const selectedLeagueId = draft.league_id || fallbackLeagueId;
      const season = draft.season ?? selectedLeague?.season ?? String(new Date().getFullYear());
      const isSuperflex =
        selectedLeague?.league_id === selectedLeagueId
          ? (selectedLeague.roster_positions ?? []).includes('SUPER_FLEX')
          : false;

      const [playersById, ktcPlayers] = await firstValueFrom(
        forkJoin([sleeper.getAllPlayers(), ktc.fetchPlayers(isSuperflex)]),
      );

      // Build player name map from all players
      const playerNameMap = Object.entries(playersById).reduce<Record<string, string>>((acc, [id, player]) => {
        const firstName = player.first_name ?? '';
        const lastName = player.last_name ?? '';
        const fullName = player.full_name?.trim() || `${firstName} ${lastName}`.trim();
        if (fullName.length > 0) {
          acc[id] = fullName;
        }
        return acc;
      }, {});

      const ktcLookup = ktc.buildNameLookup(ktcPlayers);
      const rows = mapRows(playersById, ktcLookup, Number(season));

      let rosterDisplayNames: Record<string, string> = {};
      if (selectedLeagueId) {
        try {
          const [rosters, users] = await firstValueFrom(
            forkJoin([
              sleeper.getLeagueRosters(selectedLeagueId),
              sleeper.getLeagueUsers(selectedLeagueId),
            ]),
          );
          rosterDisplayNames = mapRosterDisplayNames(rosters, users);
        } catch {
          rosterDisplayNames = {};
        }
      }

      return {
        selectedLeagueId,
        rosterDisplayNames,
        playerNameMap,
        rows,
        starredPlayerIds: loadStarredPlayerIds(selectedLeagueId),
      };
    };

    const refreshDraft = async (): Promise<void> => {
      if (refreshInFlight) {
        return;
      }

      const selectedDraftId = store.selectedDraftId();
      if (!selectedDraftId) {
        return;
      }

      refreshInFlight = true;
      try {
        const [draft, picks] = await firstValueFrom(
          forkJoin([sleeper.getDraft(selectedDraftId), sleeper.getDraftPicks(selectedDraftId)]),
        );

        patchState(store, {
          draftStatus: draft.status ?? null,
          drafts: upsertDraft(store.drafts(), draft),
          picks: normalizePicks(draft, picks),
          staleData: false,
          lastUpdatedAt: Date.now(),
          error: null,
        });
      } catch {
        patchState(store, {
          staleData: true,
          error: 'Failed to refresh draft state. Retrying automatically.',
        });
      } finally {
        refreshInFlight = false;
        maybeStartPolling();
      }
    };

    const loadForLeague = async (leagueId: string, season: string): Promise<void> => {
      patchState(store, {
        loading: true,
        error: null,
        staleData: false,
        selectedLeagueId: leagueId,
        picks: [],
      });

      try {
        const isSuperflex = (appStore.selectedLeague()?.roster_positions ?? []).includes('SUPER_FLEX');
        const [rosters, users, playersById, ktcPlayers, drafts] = await firstValueFrom(
          forkJoin([
            sleeper.getLeagueRosters(leagueId),
            sleeper.getLeagueUsers(leagueId),
            sleeper.getAllPlayers(),
            ktc.fetchPlayers(isSuperflex),
            sleeper.getLeagueDrafts(leagueId),
          ]),
        );

        const rosterDisplayNames = mapRosterDisplayNames(rosters, users);
        const ktcLookup = ktc.buildNameLookup(ktcPlayers);
        const rows = mapRows(playersById, ktcLookup, Number(season));
        const selectedDraftId = chooseDraftId(leagueId, drafts);

        let selectedDraft: SleeperDraft | null = null;
        let picks: SleeperDraftPick[] = [];
        let nextDrafts = drafts;
        if (selectedDraftId) {
          const [draftDetail, draftPicks] = await firstValueFrom(
            forkJoin([sleeper.getDraft(selectedDraftId), sleeper.getDraftPicks(selectedDraftId)]),
          );
          selectedDraft = draftDetail;
          nextDrafts = upsertDraft(drafts, draftDetail);
          picks = normalizePicks(draftDetail, draftPicks);
        }

        const starredPlayerIds = (() => {
          try {
            const raw = localStorage.getItem(starStorageKey(leagueId));
            if (!raw) return [];
            const parsed = JSON.parse(raw) as string[];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();

        patchState(store, {
          loading: false,
          selectedLeagueId: leagueId,
          draftSource: selectedDraftId ? 'league' : store.draftSource(),
          drafts: nextDrafts,
          selectedDraftId,
          draftStatus: selectedDraft?.status ?? null,
          rosterDisplayNames,
          rows,
          picks,
          rookiesOnly: selectedDraft ? isSleeperRookieDraft(selectedDraft) : false,
          starredPlayerIds,
          lastUpdatedAt: Date.now(),
        });

        if (selectedDraftId) {
          try {
            localStorage.setItem(selectedDraftStorageKey(leagueId), selectedDraftId);
          } catch {
            // ignore localStorage errors
          }
        }
      } catch (error: unknown) {
        patchState(store, {
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load draft data.',
        });
      } finally {
        maybeStartPolling();
      }
    };

    const resetForNoLeague = (): void => {
      stopPolling();
      patchState(store, {
        loading: false,
        error: null,
        staleData: false,
        selectedLeagueId: null,
        draftSource: null,
        drafts: [],
        selectedDraftId: null,
        draftStatus: null,
        rosterDisplayNames: {},
        picks: [],
        rows: [],
        starredPlayerIds: [],
        lastUpdatedAt: null,
      });
    };

    return {
      async loadForSelectedLeague(): Promise<void> {
        const selectedLeague = appStore.selectedLeague();
        if (!selectedLeague) {
          resetForNoLeague();
          return;
        }

        await loadForLeague(selectedLeague.league_id, selectedLeague.season);
      },
      async selectDraft(draftId: string, options?: SelectDraftOptions): Promise<void> {
        const fallbackLeagueId = store.selectedLeagueId() ?? appStore.selectedLeague()?.league_id ?? null;

        patchState(store, {
          selectedDraftId: draftId,
          loading: true,
          error: null,
        });

        try {
          const [draft, picks] = await firstValueFrom(
            forkJoin([sleeper.getDraft(draftId), sleeper.getDraftPicks(draftId)]),
          );
          const context = await loadDraftContext(draft, fallbackLeagueId);

          const nextDrafts = upsertDraft(store.drafts(), draft);

          patchState(store, {
            loading: false,
            selectedLeagueId: context.selectedLeagueId,
            draftSource: options?.source ?? store.draftSource() ?? 'league',
            rosterDisplayNames: context.rosterDisplayNames,
            playerNameMap: context.playerNameMap,
            rows: context.rows,
            drafts: nextDrafts,
            draftStatus: draft.status ?? null,
            picks: normalizePicks(draft, picks),
            rookiesOnly: options?.rookieHint === true ? true : isSleeperRookieDraft(draft),
            starredPlayerIds: context.starredPlayerIds,
            staleData: false,
            lastUpdatedAt: Date.now(),
          });

          if (context.selectedLeagueId) {
            try {
              localStorage.setItem(selectedDraftStorageKey(context.selectedLeagueId), draftId);
            } catch {
              // ignore localStorage errors
            }
          }
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load draft details.',
          });
        } finally {
          maybeStartPolling();
        }
      },
      async refreshNow(): Promise<void> {
        await refreshDraft();
      },
      retry(): void {
        void this.loadForSelectedLeague();
      },
      togglePosition(position: DraftPositionFilter): void {
        const current = store.selectedPositions();
        const hasPosition = current.includes(position);
        if (hasPosition && current.length === 1) {
          return;
        }

        patchState(store, {
          selectedPositions: hasPosition
            ? current.filter((currentPosition) => currentPosition !== position)
            : [...current, position],
        });
      },
      setRookiesOnly(value: boolean): void {
        patchState(store, { rookiesOnly: value });
      },
      toggleStar(playerId: string): void {
        const current = store.starredPlayerIds();
        const next = current.includes(playerId)
          ? current.filter((id) => id !== playerId)
          : [...current, playerId];

        patchState(store, { starredPlayerIds: next });

        const leagueId = store.selectedLeagueId();
        if (!leagueId) {
          return;
        }

        try {
          localStorage.setItem(starStorageKey(leagueId), JSON.stringify(next));
        } catch {
          // ignore localStorage errors
        }
      },
      stopPolling(): void {
        stopPolling();
      },
    };
  }),
  withHooks((store, appStore = inject(AppStore)) => {
    let previousLeagueId: string | null = null;
    const storeWithMethods = store as typeof store & {
      loadForSelectedLeague: () => Promise<void>;
      stopPolling: () => void;
    };

    return {
      onInit(): void {
        effect(() => {
          const leagueId = appStore.selectedLeague()?.league_id ?? null;
          if (leagueId === previousLeagueId) {
            return;
          }

          previousLeagueId = leagueId;
          void storeWithMethods.loadForSelectedLeague();
        });
      },
      onDestroy(): void {
        storeWithMethods.stopPolling();
      },
    };
  }),
);
