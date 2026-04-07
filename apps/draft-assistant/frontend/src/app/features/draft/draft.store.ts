import { computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { forkJoin, firstValueFrom } from 'rxjs';
import { KtcRatingService } from '../../core/adapters/ktc/ktc-rating.service';
import { isSleeperRookieDraft } from '../../core/adapters/sleeper/sleeper-draft.util';
import { SleeperService } from '../../core/adapters/sleeper/sleeper.service';
import {
  DraftPlayerRow,
  DraftRecommendation,
  KtcPlayer,
  LeagueRoster,
  LeagueUser,
  SleeperCatalogPlayer,
  SleeperDraft,
  SleeperDraftPick,
} from '../../core/models';
import { FlockRatingService } from '../../core/adapters/flock/flock-rating.service';
import { FlockPlayer, TierSource } from '../../core/models';
import { mapRosterAvatarIds } from './draft-board-grid/draft-board-grid.util';
import { AppStore } from '../../core/state/app.store';
import { StorageService } from '../../core/services/storage.service';
import { PlayerNormalizationService } from '../../core/services/player-normalization.service';
import { resolveTier as resolveTierUtil } from '../../core/utils/tier-resolution.util';
import { toErrorMessage } from '../../core/utils/error.util';
import { togglePositionFilter } from '../../core/utils/position-filter.util';
import { toMapById } from '../../core/utils/array-mapping.util';

export type DraftPositionFilter = 'QB' | 'RB' | 'WR' | 'TE';
export type DraftSourceMode = 'league' | 'direct';
export type DraftValueSource = 'ktcValue' | 'averageRank';

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
  rosterAvatarIds: Record<string, string | null>;
  playerNameMap: Record<string, string>;
  picks: SleeperDraftPick[];
  rows: DraftPlayerRow[];
  selectedPositions: DraftPositionFilter[];
  rookiesOnly: boolean;
  starredPlayerIds: string[];
  lastUpdatedAt: number | null;
  tierSource: TierSource;
  valueSource: DraftValueSource;
}

const DEFAULT_POSITIONS: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];

function resolveTier(row: DraftPlayerRow, tierSrc: TierSource): number {
  const ktcTier = row.positionalTier ?? row.overallTier ?? null;
  const flockTier = row.flockAveragePositionalTier ?? row.flockAverageTier ?? null;

  if (tierSrc === 'flock' && flockTier === null) {
    return ktcTier ?? Number.MAX_SAFE_INTEGER;
  }

  return resolveTierUtil(ktcTier, flockTier, tierSrc) ?? Number.MAX_SAFE_INTEGER;
}

function resolveValue(row: DraftPlayerRow, valueSrc: DraftValueSource): number {
  if (valueSrc === 'ktcValue') return row.ktcValue ?? 0;
  // averageRank is lower-is-better; negate so higher return value = better player.
  // Fall back to ktcValue when averageRank is unavailable.
  if (row.averageRank !== null) return -row.averageRank;
  return row.ktcValue ?? 0;
}

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
    rosterAvatarIds: {},
    playerNameMap: {},
    picks: [],
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    starredPlayerIds: [],
    lastUpdatedAt: null,
    tierSource: 'ktc',
    valueSource: 'ktcValue',
  }),
  withComputed((store) => ({
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
      const tierSrc = store.tierSource();
      const valueSrc = store.valueSource();
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
          const aTier = resolveTier(a, tierSrc);
          const bTier = resolveTier(b, tierSrc);
          if (aTier !== bTier) return aTier - bTier;

          const aRank = valueSrc === 'ktcValue'
            ? (a.ktcRank ?? Number.MAX_SAFE_INTEGER)
            : (a.averageRank ?? a.ktcRank ?? Number.MAX_SAFE_INTEGER);
          const bRank = valueSrc === 'ktcValue'
            ? (b.ktcRank ?? Number.MAX_SAFE_INTEGER)
            : (b.averageRank ?? b.ktcRank ?? Number.MAX_SAFE_INTEGER);
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });
    }),
    recommendations: computed(() => {
      const tierSrc = store.tierSource();
      const valueSrc = store.valueSource();
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store.picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

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
          const aTier = resolveTier(a, tierSrc);
          const bTier = resolveTier(b, tierSrc);
          if (aTier !== bTier) return aTier - bTier;

          const aPosition = positionOrder[a.position];
          const bPosition = positionOrder[b.position];
          if (aPosition !== bPosition) return aPosition - bPosition;

          return resolveValue(b, valueSrc) - resolveValue(a, valueSrc);
        });

      // Find top 3 distinct tier values
      const tierOrder: number[] = [];
      const seenTiers = new Set<number>();
      for (const row of sortedRows) {
        const tier = resolveTier(row, tierSrc);
        if (!seenTiers.has(tier)) {
          tierOrder.push(tier);
          seenTiers.add(tier);
        }
      }
      const top3Tiers = new Set(tierOrder.slice(0, 3));

      // Filter to top 3 tiers and cap at 3 players per tier
      const tierPlayerCounts = new Map<number, number>();
      const filtered = sortedRows.filter((row) => {
        const tier = resolveTier(row, tierSrc);
        if (!top3Tiers.has(tier)) return false;
        const count = tierPlayerCounts.get(tier) ?? 0;
        if (count >= 3) return false;
        tierPlayerCounts.set(tier, count + 1);
        return true;
      });

      return filtered.map<DraftRecommendation>((row) => ({
        playerId: row.playerId,
        fullName: row.fullName,
        position: row.position,
        team: row.team,
        ktcValue: row.ktcValue,
        ktcRank: row.ktcRank,
        overallTier: row.overallTier,
        positionalTier: row.positionalTier,
        flockAverageTier: row.flockAverageTier,
        flockAveragePositionalTier: row.flockAveragePositionalTier,
        averageRank: row.averageRank,
        boostedScore: resolveValue(row, valueSrc),
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
    nextPickNumber: computed(() => store.picks().length + 1),
  })),
  withMethods((store, appStore = inject(AppStore), sleeper = inject(SleeperService), ktc = inject(KtcRatingService), flock = inject(FlockRatingService), storage = inject(StorageService), playerNorm = inject(PlayerNormalizationService)) => {
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

    const getPollingInterval = (status: string | null): number | null => {
      if (!status) {
        return null;
      }

      const normalizedStatus = status.toLowerCase().trim();
      if (normalizedStatus === 'drafting') {
        return 1000;
      }
      if (normalizedStatus === 'pre_draft' || normalizedStatus === 'scheduled' || normalizedStatus === 'paused') {
        return 5000;
      }

      return null;
    };

    const maybeStartPolling = (): void => {
      const selectedDraftId = store.selectedDraftId();
      const status = store.draftStatus();
      const interval = getPollingInterval(status);

      if (!selectedDraftId || interval === null) {
        stopPolling();
        return;
      }

      if (pollHandle !== null) {
        return;
      }

      pollHandle = setInterval(() => {
        void refreshDraft();
      }, interval);
    };

    const mapRosterDisplayNames = (rosters: LeagueRoster[], users: LeagueUser[]): Record<string, string> => {
      const usersById = toMapById(users, 'user_id');

      return rosters.reduce<Record<string, string>>((acc, roster) => {
        const ownerId = roster.owner_id ?? '';
        const user = ownerId ? usersById[ownerId] : undefined;
        acc[String(roster.roster_id)] = user?.display_name ?? `Roster ${roster.roster_id}`;
        return acc;
      }, {});
    };

    const mapRows = (
      playersById: Record<string, SleeperCatalogPlayer>,
      ktcLookup: Map<string, KtcPlayer>,
      flockLookup: Map<string, FlockPlayer>,
      currentSeason: number,
    ): DraftPlayerRow[] => playerNorm.buildPlayerRows(playersById, ktcLookup, flockLookup, currentSeason);

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
      const savedDraftId = storage.getRawItem(selectedDraftStorageKey(leagueId));

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

      const parsed = storage.getItem<string[]>(starStorageKey(leagueId));
      return Array.isArray(parsed) ? parsed : [];
    };

    const loadDraftContext = async (
      draft: SleeperDraft,
      fallbackLeagueId: string | null,
    ): Promise<{
      selectedLeagueId: string | null;
      rosterDisplayNames: Record<string, string>;
      rosterAvatarIds: Record<string, string | null>;
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

      const [playersById, ktcPlayers, flockPlayers, flockRookies] = await firstValueFrom(
        forkJoin([sleeper.getAllPlayers(), ktc.fetchPlayers(isSuperflex), flock.fetchPlayers(isSuperflex), flock.fetchRookies(isSuperflex)]),
      );

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
      const isRookieDraft = isSleeperRookieDraft(draft);
      const flockLookup = isRookieDraft
        ? new Map([...flock.buildNameLookup(flockRookies), ...flock.buildNameLookup(flockPlayers)])
        : flock.buildNameLookup(flockPlayers);
      const rows = mapRows(playersById, ktcLookup, flockLookup, Number(season));

      let rosterDisplayNames: Record<string, string> = {};
      let rosterAvatarIds: Record<string, string | null> = {};
      if (selectedLeagueId) {
        try {
          const [rosters, users] = await firstValueFrom(
            forkJoin([
              sleeper.getLeagueRosters(selectedLeagueId),
              sleeper.getLeagueUsers(selectedLeagueId),
            ]),
          );
          rosterDisplayNames = mapRosterDisplayNames(rosters, users);
          rosterAvatarIds = mapRosterAvatarIds(rosters, users);
        } catch {
          rosterDisplayNames = {};
          rosterAvatarIds = {};
        }
      }

      return {
        selectedLeagueId,
        rosterDisplayNames,
        rosterAvatarIds,
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
        const [rosters, users, playersById, ktcPlayers, flockPlayers, flockRookies, drafts] = await firstValueFrom(
          forkJoin([
            sleeper.getLeagueRosters(leagueId),
            sleeper.getLeagueUsers(leagueId),
            sleeper.getAllPlayers(),
            ktc.fetchPlayers(isSuperflex),
            flock.fetchPlayers(isSuperflex),
            flock.fetchRookies(isSuperflex),
            sleeper.getLeagueDrafts(leagueId),
          ]),
        );

        const rosterDisplayNames = mapRosterDisplayNames(rosters, users);
        const rosterAvatarIds = mapRosterAvatarIds(rosters, users);
        const ktcLookup = ktc.buildNameLookup(ktcPlayers);
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

        const isRookieDraft = selectedDraft ? isSleeperRookieDraft(selectedDraft) : false;
        const flockLookup = isRookieDraft
          ? new Map([...flock.buildNameLookup(flockRookies), ...flock.buildNameLookup(flockPlayers)])
          : flock.buildNameLookup(flockPlayers);
        const rows = mapRows(playersById, ktcLookup, flockLookup, Number(season));

        const starredPlayerIds = (() => {
          const parsed = storage.getItem<string[]>(starStorageKey(leagueId));
          return Array.isArray(parsed) ? parsed : [];
        })();

        patchState(store, {
          loading: false,
          selectedLeagueId: leagueId,
          draftSource: selectedDraftId ? 'league' : store.draftSource(),
          drafts: nextDrafts,
          selectedDraftId,
          draftStatus: selectedDraft?.status ?? null,
          rosterDisplayNames,
          rosterAvatarIds,
          rows,
          picks,
          rookiesOnly: isRookieDraft,
          starredPlayerIds,
          lastUpdatedAt: Date.now(),
        });

        if (selectedDraftId) {
          storage.setRawItem(selectedDraftStorageKey(leagueId), selectedDraftId);
        }
      } catch (error: unknown) {
        patchState(store, {
          loading: false,
          error: toErrorMessage(error, 'Failed to load draft data.'),
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
        rosterAvatarIds: {},
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
            rosterAvatarIds: context.rosterAvatarIds,
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
            storage.setRawItem(selectedDraftStorageKey(context.selectedLeagueId), draftId);
          }
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error: toErrorMessage(error, 'Failed to load draft details.'),
          });
        } finally {
          maybeStartPolling();
        }
      },
      async refreshNow(): Promise<void> {
        await refreshDraft();
      },
      retry(): void {
        if (store.selectedDraftId()) {
          void refreshDraft();
          return;
        }

        void this.loadForSelectedLeague();
      },
      setDraftSource(source: DraftSourceMode): void {
        patchState(store, {
          draftSource: source,
          error: null,
        });
      },
      setTierSource(tierSource: TierSource): void {
        patchState(store, { tierSource });
      },
      setValueSource(valueSource: DraftValueSource): void {
        patchState(store, { valueSource });
      },
      togglePosition(position: DraftPositionFilter): void {
        patchState(store, {
          selectedPositions: togglePositionFilter(store.selectedPositions(), position),
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

        storage.setItem(starStorageKey(leagueId), next);
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
