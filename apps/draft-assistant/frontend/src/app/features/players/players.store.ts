import { computed, effect, inject } from "@angular/core";
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from "@ngrx/signals";
import { firstValueFrom } from "rxjs";
import { KtcRatingService } from "../../core/adapters/ktc/ktc-rating.service";
import { SleeperService } from "../../core/adapters/sleeper/sleeper.service";
import { TierSource } from "../../core/models";
import { AppStore } from "../../core/state/app.store";
import { PlayerNormalizationService } from "../../core/services/player-normalization.service";
import {
  ConsensusAggregatorService,
  ConsensusInput,
} from "../../core/services/consensus-aggregator.service";
import { toErrorMessage } from "../../core/utils/error.util";
import { togglePositionFilter } from "../../core/utils/position-filter.util";
import {
  filterAndSortPlayerRows,
  PlayerRow,
  PositionFilter,
  SortBy,
  SortDirection,
  ValueSource,
} from "./players-display.util";

export type { PlayerRow, PositionFilter, SortBy, SortDirection, ValueSource };

interface PlayersState {
  loading: boolean;
  error: string | null;
  ktcUnavailable: boolean;
  ktcSyncedAt: string | null;
  rows: PlayerRow[];
  selectedPositions: PositionFilter[];
  rookiesOnly: boolean;
  freeAgentsOnly: boolean;
  assignedPlayerIds: string[];
  searchQuery: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
  tierSource: TierSource;
  valueSource: ValueSource;
}

const DEFAULT_POSITIONS: PositionFilter[] = ["QB", "RB", "WR", "TE"];

export const PlayersStore = signalStore(
  withState<PlayersState>({
    loading: false,
    error: null,
    ktcUnavailable: false,
    ktcSyncedAt: null,
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    freeAgentsOnly: false,
    assignedPlayerIds: [],
    searchQuery: "",
    sortBy: "weightedComposite",
    sortDirection: "asc",
    tierSource: "flock",
    valueSource: "averageRank",
  }),
  withComputed((store) => ({
    hasRows: computed(() => store.rows().length > 0),
    displayedRows: computed(() =>
      filterAndSortPlayerRows(
        store.rows(),
        store.selectedPositions(),
        store.rookiesOnly(),
        store.freeAgentsOnly(),
        store.assignedPlayerIds(),
        store.sortBy(),
        store.sortDirection(),
        store.valueSource(),
        store.searchQuery(),
      ),
    ),
    ktcStaleDays: computed((): number | null => {
      const synced = store.ktcSyncedAt();
      if (!synced) return null;
      const diffMs = Date.now() - new Date(synced).getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }),
  })),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      ktcService = inject(KtcRatingService),
      playerNorm = inject(PlayerNormalizationService),
      sleeperService = inject(SleeperService),
      aggregator = inject(ConsensusAggregatorService),
    ) => {
      return {
        async loadPlayers(): Promise<void> {
          patchState(store, { loading: true, error: null });

          try {
            const selectedLeague = appStore.selectedLeague();
            const isSuperflex = (selectedLeague?.roster_positions ?? []).includes("SUPER_FLEX");
            const currentSeason = Number(selectedLeague?.season ?? new Date().getFullYear());

            const rostersPromise = selectedLeague
              ? firstValueFrom(sleeperService.getLeagueRosters(selectedLeague.league_id)).catch(() => [])
              : Promise.resolve([]);

            const [rows, ktcPlayers, metadata, rosters] = await Promise.all([
              playerNorm.buildPlayerRows({
                format: { isSuperflex, isRookie: false },
                season: currentSeason,
                sources: ["ktc", "flock"],
              }),
              firstValueFrom(ktcService.fetchPlayers(isSuperflex)),
              firstValueFrom(ktcService.fetchMetadata()),
              rostersPromise,
            ]);

            const assignedPlayerIds = rosters.flatMap((r) => r.players ?? []);

            const inputs: ConsensusInput[] = rows.map((row) => ({
              playerId: row.playerId,
              position: row.position,
              sources: [
                ...(row.ktcRank != null ? [{ source: "ktc", rank: row.ktcRank }] : []),
                ...(row.averageRank != null ? [{ source: "flock", rank: row.averageRank }] : []),
              ],
            }));
            const consensus = aggregator.aggregate(inputs, { weights: { ktc: 1, flock: 1 } });
            const enrichedRows: PlayerRow[] = rows.map((row) => ({
              ...row,
              baseValue: consensus.get(row.playerId)?.baseValue ?? null,
            }));

            patchState(store, {
              rows: enrichedRows,
              assignedPlayerIds,
              loading: false,
              ktcUnavailable: ktcPlayers.length === 0,
              ktcSyncedAt: metadata?.generatedAt ?? null,
            });
          } catch (error: unknown) {
            patchState(store, {
              loading: false,
              error: toErrorMessage(error, "Failed to load players."),
            });
          }
        },
        togglePosition(position: PositionFilter): void {
          patchState(store, {
            selectedPositions: togglePositionFilter(store.selectedPositions(), position),
          });
        },
        setRookiesOnly(rookiesOnly: boolean): void {
          patchState(store, { rookiesOnly });
        },
        setFreeAgentsOnly(freeAgentsOnly: boolean): void {
          patchState(store, { freeAgentsOnly });
        },
        setSortBy(sortBy: SortBy): void {
          patchState(store, { sortBy });
        },
        setSortDirection(sortDirection: SortDirection): void {
          patchState(store, { sortDirection });
        },
        setTierSource(tierSource: TierSource): void {
          patchState(store, { tierSource });
        },
        setValueSource(valueSource: ValueSource): void {
          patchState(store, { valueSource });
        },
        setSearchQuery(searchQuery: string): void {
          patchState(store, { searchQuery });
        },
      };
    },
  ),
  withHooks((store, appStore = inject(AppStore)) => {
    const storeWithMethods = store as typeof store & { loadPlayers: () => Promise<void> };
    let previousLeagueId: string | null = null;

    return {
      onInit(): void {
        effect(() => {
          const leagueId = appStore.selectedLeague()?.league_id ?? null;
          if (leagueId === previousLeagueId && store.rows().length > 0) {
            return;
          }
          previousLeagueId = leagueId;
          void storeWithMethods.loadPlayers();
        });
      },
    };
  }),
);
