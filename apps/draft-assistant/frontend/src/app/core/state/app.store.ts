import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';

const STORAGE_KEY_USER = 'draftAssistant.sleeperUser';
const STORAGE_KEY_LEAGUE = 'draftAssistant.selectedLeague';

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
      try { localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)); } catch { /* ignore */ }
    },
    setSelectedLeague(league: League): void {
      patchState(store, { selectedLeague: league });
      try { localStorage.setItem(STORAGE_KEY_LEAGUE, JSON.stringify(league)); } catch { /* ignore */ }
    },
    clearUser(): void {
      patchState(store, { user: null, selectedLeague: null });
      try {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_LEAGUE);
      } catch { /* ignore */ }
    },
  })),
  withHooks((store) => ({
    onInit(): void {
      try {
        const rawUser = localStorage.getItem(STORAGE_KEY_USER);
        const rawLeague = localStorage.getItem(STORAGE_KEY_LEAGUE);
        if (rawUser) patchState(store, { user: JSON.parse(rawUser) as SleeperUser });
        if (rawLeague) patchState(store, { selectedLeague: JSON.parse(rawLeague) as League });
      } catch { /* ignore corrupt storage */ }
    },
  })),
);
