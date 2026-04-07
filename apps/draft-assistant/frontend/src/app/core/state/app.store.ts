import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';
import { StorageService } from '../services/storage.service';

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
  withMethods((store, storage = inject(StorageService)) => ({
    setUser(user: SleeperUser): void {
      patchState(store, { user });
      storage.setItem(STORAGE_KEY_USER, user);
    },
    setSelectedLeague(league: League): void {
      patchState(store, { selectedLeague: league });
      storage.setItem(STORAGE_KEY_LEAGUE, league);
    },
    clearUser(): void {
      patchState(store, { user: null, selectedLeague: null });
      storage.removeItem(STORAGE_KEY_USER);
      storage.removeItem(STORAGE_KEY_LEAGUE);
    },
    setDensityScale(densityScale: number): void {
      if (!ALLOWED_DENSITY_SCALES.has(densityScale)) {
        return;
      }
      patchState(store, { densityScale });
      storage.setRawItem(STORAGE_KEY_DENSITY, String(densityScale));
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
  withHooks((store, storage = inject(StorageService)) => ({
    onInit(): void {
      const savedUser = storage.getItem<SleeperUser>(STORAGE_KEY_USER);
      const savedLeague = storage.getItem<League>(STORAGE_KEY_LEAGUE);
      const rawDensity = storage.getRawItem(STORAGE_KEY_DENSITY);

      if (savedUser) patchState(store, { user: savedUser });
      if (savedLeague) patchState(store, { selectedLeague: savedLeague });

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

