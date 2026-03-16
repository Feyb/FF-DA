import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';

export interface AppState {
  user: SleeperUser | null;
  selectedLeague: League | null;
}

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>({
    user: null,
    selectedLeague: null,
  }),
  withMethods((store) => ({
    setUser(user: SleeperUser): void {
      patchState(store, { user });
    },
    setSelectedLeague(league: League): void {
      patchState(store, { selectedLeague: league });
    },
    clearUser(): void {
      patchState(store, { user: null, selectedLeague: null });
    },
  })),
);
