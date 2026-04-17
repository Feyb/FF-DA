import { computed, effect, inject } from "@angular/core";
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from "@ngrx/signals";
import { forkJoin, firstValueFrom } from "rxjs";
import { FlockRatingService } from "../../core/adapters/flock/flock-rating.service";
import { KtcRatingService } from "../../core/adapters/ktc/ktc-rating.service";
import { SleeperService } from "../../core/adapters/sleeper/sleeper.service";
import { TierSource } from "../../core/models";
import { AppStore } from "../../core/state/app.store";
import { PlayerNormalizationService } from "../../core/services/player-normalization.service";
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
  rows: PlayerRow[];
  selectedPositions: PositionFilter[];
  rookiesOnly: boolean;
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
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    sortBy: "default",
    sortDirection: "asc",
    tierSource: "average",
    valueSource: "ktcValue",
  }),
  withComputed((store) => ({
    hasRows: computed(() => store.rows().length > 0),
    displayedRows: computed(() =>
      filterAndSortPlayerRows(
        store.rows(),
        store.selectedPositions(),
        store.rookiesOnly(),
        store.sortBy(),
        store.sortDirection(),
        store.valueSource(),
      ),
    ),
  })),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      sleeperService = inject(SleeperService),
      ktcService = inject(KtcRatingService),
      flockService = inject(FlockRatingService),
      playerNorm = inject(PlayerNormalizationService),
    ) => {
      return {
        async loadPlayers(): Promise<void> {
          patchState(store, { loading: true, error: null });

          try {
            const selectedLeague = appStore.selectedLeague();
            const isSuperflex = (selectedLeague?.roster_positions ?? []).includes("SUPER_FLEX");
            const currentSeason = Number(selectedLeague?.season ?? new Date().getFullYear());

            const [allPlayers, ktcPlayers, flockPlayers] = await firstValueFrom(
              forkJoin([
                sleeperService.getAllPlayers(),
                ktcService.fetchPlayers(isSuperflex),
                flockService.fetchPlayers(isSuperflex),
              ]),
            );

            const ktcLookup = ktcService.buildNameLookup(ktcPlayers);
            const flockLookup = flockService.buildNameLookup(flockPlayers);

            const rows: PlayerRow[] = playerNorm.buildPlayerRows(
              allPlayers,
              ktcLookup,
              flockLookup,
              currentSeason,
            );

            patchState(store, {
              rows,
              loading: false,
              ktcUnavailable: ktcPlayers.length === 0,
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
