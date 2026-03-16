import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import { SleeperService } from '../../core/adapters/sleeper/sleeper.service';
import { AppStore } from '../../core/state/app.store';
import { League } from '../../core/models';

interface HomeState {
  leagues: League[];
  loading: boolean;
  error: string | null;
}

export const HomeStore = signalStore(
  withState<HomeState>({ leagues: [], loading: false, error: null }),
  withComputed((store) => ({
    hasLeagues: computed(() => store.leagues().length > 0),
  })),
  withMethods(
    (
      store,
      sleeperService = inject(SleeperService),
      appStore = inject(AppStore),
    ) => ({
      loadByUsername: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((username) =>
            sleeperService.getUserByUsername(username).pipe(
              switchMap((user) => {
                appStore.setUser(user);
                const season = String(new Date().getFullYear());
                return sleeperService.getLeaguesByUserId(user.user_id, season);
              }),
              tapResponse({
                next: (leagues) =>
                  patchState(store, { leagues, loading: false }),
                error: (err: unknown) =>
                  patchState(store, {
                    loading: false,
                    error:
                      err instanceof Error
                        ? err.message
                        : 'Failed to load leagues',
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
                next: (league) =>
                  patchState(store, { leagues: [league], loading: false }),
                error: (err: unknown) =>
                  patchState(store, {
                    loading: false,
                    error:
                      err instanceof Error
                        ? err.message
                        : 'Failed to load league',
                  }),
              }),
            ),
          ),
        ),
      ),
      selectLeague(league: League): void {
        appStore.setSelectedLeague(league);
      },
    }),
  ),
);
