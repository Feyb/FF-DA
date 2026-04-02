import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';

const STORAGE_KEY_USER = 'draftAssistant.sleeperUser';
const STORAGE_KEY_LEAGUE = 'draftAssistant.selectedLeague';
const STORAGE_KEY_DENSITY = 'draftAssistant.materialDensity';
const STORAGE_KEY_DARK_MODE = 'draftAssistant.darkMode';
const ALLOWED_DENSITY_SCALES = new Set([-5, -4, -3, -2, -1, 0]);

export interface AppState {
  user: SleeperUser | null;
  selectedLeague: League | null;
  densityScale: number;
  darkMode: boolean;
}

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>({
    user: null,
    selectedLeague: null,
    densityScale: 0,
    darkMode: false,
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
    toggleDarkMode(): void {
      const next = !store.darkMode();
      patchState(store, { darkMode: next });
      try {
        localStorage.setItem(STORAGE_KEY_DARK_MODE, String(next));
      } catch { /* ignore */ }
    },
    setDarkMode(darkMode: boolean): void {
      patchState(store, { darkMode });
      try {
        localStorage.setItem(STORAGE_KEY_DARK_MODE, String(darkMode));
      } catch { /* ignore */ }
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

        const rawDarkMode = localStorage.getItem(STORAGE_KEY_DARK_MODE);
        if (rawDarkMode !== null) {
          patchState(store, { darkMode: rawDarkMode === 'true' });
        } else {
          // Fall back to OS preference
          const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
          patchState(store, { darkMode: prefersDark });
        }
      } catch { /* ignore corrupt storage */ }
    },
  })),
);
