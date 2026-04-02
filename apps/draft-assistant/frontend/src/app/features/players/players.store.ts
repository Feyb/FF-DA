import { computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { forkJoin, firstValueFrom } from 'rxjs';
import { FlockRatingService } from '../../core/adapters/flock/flock-rating.service';
import { KtcRatingService } from '../../core/adapters/ktc/ktc-rating.service';
import { SleeperService } from '../../core/adapters/sleeper/sleeper.service';
import { FlockPlayer, KtcPlayer, SleeperCatalogPlayer, TierSource } from '../../core/models';
import { AppStore } from '../../core/state/app.store';

export type PositionFilter = 'QB' | 'RB' | 'WR' | 'TE';
export type SortBy = 'default' | 'name' | 'position' | 'age' | 'ktcValue' | 'team';
export type SortDirection = 'asc' | 'desc';
export type ValueSource = 'ktcValue' | 'averageRank';

export interface PlayerRow {
  playerId: string;
  fullName: string;
  position: PositionFilter;
  team: string | null;
  age: number | null;
  rookie: boolean;
  ktcValue: number | null;
  averageRank: number | null;
  ktcRank: number | null;
  overallTier: number | null;
  positionalTier: number | null;
  flockAverageTier: number | null;
  flockAveragePositionalTier: number | null;
  sleeperRank: number;
}

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

const DEFAULT_POSITIONS: PositionFilter[] = ['QB', 'RB', 'WR', 'TE'];

export const PlayersStore = signalStore(
  withState<PlayersState>({
    loading: false,
    error: null,
    ktcUnavailable: false,
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    sortBy: 'default',
    sortDirection: 'asc',
    tierSource: 'average',
    valueSource: 'ktcValue',
  }),
  withComputed((store) => ({
    hasRows: computed(() => store.rows().length > 0),
    displayedRows: computed(() => {
      const selected = new Set(store.selectedPositions());
      const filtered = store.rows().filter((row) => {
        if (!selected.has(row.position)) return false;
        if (store.rookiesOnly() && !row.rookie) return false;
        return true;
      });

      const sortBy = store.sortBy();
      const sortDirection = store.sortDirection();
      const dir = sortDirection === 'asc' ? 1 : -1;

      const valueSource = store.valueSource();

      const sort = [...filtered].sort((a, b) => {
        if (sortBy === 'default') {
          const aRank = (valueSource === 'ktcValue' ? a.ktcRank : a.averageRank) ?? Number.MAX_SAFE_INTEGER;
          const bRank = (valueSource === 'ktcValue' ? b.ktcRank : b.averageRank) ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        }

        if (sortBy === 'name') {
          return a.fullName.localeCompare(b.fullName) * dir;
        }

        if (sortBy === 'position') {
          return a.position.localeCompare(b.position) * dir;
        }

        if (sortBy === 'age') {
          const aAge = a.age ?? Number.MAX_SAFE_INTEGER;
          const bAge = b.age ?? Number.MAX_SAFE_INTEGER;
          return (aAge - bAge) * dir;
        }

        if (sortBy === 'ktcValue') {
          const aValue = (valueSource === 'ktcValue' ? a.ktcValue : a.averageRank) ?? -1;
          const bValue = (valueSource === 'ktcValue' ? b.ktcValue : b.averageRank) ?? -1;
          return (aValue - bValue) * dir;
        }

        const aTeam = a.team ?? 'ZZZ';
        const bTeam = b.team ?? 'ZZZ';
        return aTeam.localeCompare(bTeam) * dir;
      });

      return sort;
    }),
  })),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      sleeperService = inject(SleeperService),
      ktcService = inject(KtcRatingService),
      flockService = inject(FlockRatingService),
    ) => {
    const isActiveSleeperPlayer = (source: SleeperCatalogPlayer): boolean => {
      if (source.active === false) return false;

      const status = source.status?.toLowerCase().trim();
      if (!status) return true;

      return status === 'active';
    };

    const normalizeSleeperPlayer = (
      playerId: string,
      source: SleeperCatalogPlayer,
      ktcLookup: Map<string, KtcPlayer>,
      flockLookup: Map<string, FlockPlayer>,
      currentSeason: number,
    ): Omit<PlayerRow, 'sleeperRank'> => {
      const firstName = source.first_name ?? '';
      const lastName = source.last_name ?? '';
      const fullName = source.full_name?.trim() || `${firstName} ${lastName}`.trim();
      const positionRaw = source.position ?? '';
      const position = positionRaw as PositionFilter;

      const ktcPlayer = ktcLookup.get(ktcService.normalizeName(fullName));
      const flockPlayer = flockLookup.get(flockService.normalizeName(fullName));

      return {
        playerId,
        fullName,
        position,
        team: source.team ?? null,
        age: source.age ?? null,
        rookie: ktcPlayer?.rookie ?? source.rookie_year === currentSeason,
        ktcValue: ktcPlayer?.value ?? null,
        averageRank: flockPlayer?.averageRank ?? null,
        ktcRank: ktcPlayer?.rank ?? null,
        overallTier: ktcPlayer?.overallTier ?? null,
        positionalTier: ktcPlayer?.positionalTier ?? null,
        flockAverageTier: flockPlayer?.averageTier ?? null,
        flockAveragePositionalTier: flockPlayer?.averagePositionalTier ?? null,
      };
    };

    return {
      async loadPlayers(): Promise<void> {
        patchState(store, { loading: true, error: null });

        try {
          const selectedLeague = appStore.selectedLeague();
          const isSuperflex = (selectedLeague?.roster_positions ?? []).includes('SUPER_FLEX');
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

          const rawRows: Omit<PlayerRow, 'sleeperRank'>[] = Object.entries(allPlayers)
            .filter(([, source]) => isActiveSleeperPlayer(source))
            .map(([playerId, source]) => normalizeSleeperPlayer(playerId, source, ktcLookup, flockLookup, currentSeason))
            .filter((row) => row.fullName.length > 0)
            .filter((row) => DEFAULT_POSITIONS.includes(row.position))
            .filter((row) => row.team !== null || row.rookie);

          const sleeperSorted = [...rawRows].sort((a, b) => {
            const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
            const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
            return aRank - bRank;
          });
          const sleeperRankMap = new Map<string, number>();
          for (let i = 0; i < sleeperSorted.length; i++) {
            sleeperRankMap.set(sleeperSorted[i].playerId, i + 1);
          }

          const rows: PlayerRow[] = rawRows.map((row) => ({
            ...row,
            sleeperRank: sleeperRankMap.get(row.playerId) ?? Number.MAX_SAFE_INTEGER,
          }));

          patchState(store, {
            rows,
            loading: false,
            ktcUnavailable: ktcPlayers.length === 0,
          });
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load players.',
          });
        }
      },
      togglePosition(position: PositionFilter): void {
        const current = store.selectedPositions();
        const has = current.includes(position);

        if (has && current.length === 1) return;

        patchState(store, {
          selectedPositions: has ? current.filter((p) => p !== position) : [...current, position],
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
