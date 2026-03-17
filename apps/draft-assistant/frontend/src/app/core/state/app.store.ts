import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';

const STORAGE_KEY_USER = 'draftAssistant.sleeperUser';
const STORAGE_KEY_LEAGUE = 'draftAssistant.selectedLeague';
const STORAGE_KEY_DENSITY = 'draftAssistant.materialDensity';
const ALLOWED_DENSITY_SCALES = new Set([-5, -4, -3, -2, -1, 0]);

export interface AppState {
  user: SleeperUser | null;
  selectedLeague: League | null;
  densityScale: number;
}

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>({
    user: null,
    selectedLeague: null,
    densityScale: 0,
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
    setDensityScale(densityScale: number): void {
      if (!ALLOWED_DENSITY_SCALES.has(densityScale)) {
        return;
      }

      patchState(store, { densityScale });
      try {
        localStorage.setItem(STORAGE_KEY_DENSITY, String(densityScale));
      } catch {
        // ignore localStorage errors
      }
    },
  })),
  withHooks((store) => ({
    onInit(): void {
      try {
        const rawUser = localStorage.getItem(STORAGE_KEY_USER);
        const rawLeague = localStorage.getItem(STORAGE_KEY_LEAGUE);
        const rawDensity = localStorage.getItem(STORAGE_KEY_DENSITY);
        if (rawUser) patchState(store, { user: JSON.parse(rawUser) as SleeperUser });
        if (rawLeague) patchState(store, { selectedLeague: JSON.parse(rawLeague) as League });

        const parsedDensity = Number(rawDensity);
        if (ALLOWED_DENSITY_SCALES.has(parsedDensity)) {
          patchState(store, { densityScale: parsedDensity });
        }
      } catch { /* ignore corrupt storage */ }
    },
  })),
);
