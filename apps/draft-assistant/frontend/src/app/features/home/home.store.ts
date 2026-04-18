import { computed, inject } from "@angular/core";
import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { tapResponse } from "@ngrx/operators";
import { pipe, switchMap, tap } from "rxjs";
import { SleeperService } from "../../core/adapters/sleeper/sleeper.service";
import { AppStore } from "../../core/state/app.store";
import { StorageService } from "../../core/services/storage.service";
import { League } from "../../core/models";
import { toErrorMessage } from "../../core/utils/error.util";

const SELECTED_SEASON_STORAGE_KEY = "draftAssistant.selectedSeason";

interface HomeState {
  leagues: League[];
  loading: boolean;
  error: string | null;
  selectedSeason: string;
}

export const HomeStore = signalStore(
  withState<HomeState>({
    leagues: [],
    loading: false,
    error: null,
    selectedSeason: String(new Date().getFullYear()),
  }),
  withComputed((store) => ({
    hasLeagues: computed(() => store.leagues().length > 0),
  })),
  withMethods(
    (
      store,
      sleeperService = inject(SleeperService),
      appStore = inject(AppStore),
      storage = inject(StorageService),
    ) => ({
      loadByUsername: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((username) =>
            sleeperService.getUserByUsername(username).pipe(
              switchMap((user) => {
                appStore.setUser(user);
                const season = store.selectedSeason();
                return sleeperService.getLeaguesByUserId(user.user_id, season);
              }),
              tapResponse({
                next: (leagues) => {
                  patchState(store, { leagues, loading: false });
                  // Auto-select the previously stored league using fresh data
                  const storedLeagueId = appStore.selectedLeague()?.league_id;
                  if (storedLeagueId) {
                    const match = leagues.find((l) => l.league_id === storedLeagueId);
                    if (match) appStore.setSelectedLeague(match);
                  }
                },
                error: (err: unknown) =>
                  patchState(store, {
                    loading: false,
                    error: toErrorMessage(err, "Failed to load leagues"),
                  }),
              }),
            ),
          ),
        ),
      ),
      loadByLeagueId: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((leagueId) =>
            sleeperService.getLeagueById(leagueId).pipe(
              tapResponse({
                next: (league) => patchState(store, { leagues: [league], loading: false }),
                error: (err: unknown) =>
                  patchState(store, {
                    loading: false,
                    error: toErrorMessage(err, "Failed to load league"),
                  }),
              }),
            ),
          ),
        ),
      ),
      selectLeague(league: League): void {
        appStore.setSelectedLeague(league);
      },
      setSelectedSeason(season: string): void {
        patchState(store, { selectedSeason: season });
        storage.setRawItem(SELECTED_SEASON_STORAGE_KEY, season);
      },
    }),
  ),
  withHooks((store, storage = inject(StorageService)) => ({
    onInit(): void {
      const currentYear = new Date().getFullYear();
      const stored = storage.getRawItem(SELECTED_SEASON_STORAGE_KEY);
      if (stored) {
        const year = Number(stored);
        if (!isNaN(year) && year >= 2020 && year <= currentYear) {
          patchState(store, { selectedSeason: stored });
        }
      }
    },
  })),
);
