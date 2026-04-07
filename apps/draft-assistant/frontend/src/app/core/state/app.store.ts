import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { League, SleeperUser } from '../models';
import { StorageService } from '../services/storage.service';

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
    },
  })),
);

