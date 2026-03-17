import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { forkJoin, firstValueFrom } from 'rxjs';
import { KtcRatingService } from '../../core/adapters/ktc/ktc-rating.service';
import { SleeperService } from '../../core/adapters/sleeper/sleeper.service';
import {
  DraftPick,
  KtcPlayer,
  LeagueRoster,
  LeagueUser,
  SleeperCatalogPlayer,
  TeamViewPlayer,
  TeamViewRating,
  TeamViewRosterOption,
  TeamViewRosterSections,
} from '../../core/models';
import { AppStore } from '../../core/state/app.store';

interface TeamViewState {
  loading: boolean;
  error: string | null;
  selectedLeagueId: string | null;
  availableRosters: TeamViewRosterOption[];
  selectedRosterId: number | null;
  sections: TeamViewRosterSections;
  rating: TeamViewRating | null;
  ratingWarning: string | null;
}

const emptySections = (): TeamViewRosterSections => ({
  starters: [],
  bench: [],
  ir: [],
  futurePicks: [],
});

export const TeamViewStore = signalStore(
  withState<TeamViewState>({
    loading: false,
    error: null,
    selectedLeagueId: null,
    availableRosters: [],
    selectedRosterId: null,
    sections: emptySections(),
    rating: null,
    ratingWarning: null,
  }),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      sleeperService = inject(SleeperService),
      ratingService = inject(KtcRatingService),
    ) => {
      let rostersCache: LeagueRoster[] = [];
      let usersByIdCache: Record<string, LeagueUser> = {};
      let playersByIdCache: Record<string, SleeperCatalogPlayer> = {};
      let seasonCache = '';
      let ktcLookupCache: Map<string, KtcPlayer> = new Map();

      const sortByValueDesc = (players: TeamViewPlayer[]): TeamViewPlayer[] =>
        [...players].sort((a, b) => {
          const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
          return aRank - bRank;
        });

      const buildRosterOptions = (
        rosters: LeagueRoster[],
        usersById: Record<string, LeagueUser>,
      ): TeamViewRosterOption[] =>
        rosters
          .map((roster) => {
            const owner = roster.owner_id ? usersById[roster.owner_id] : undefined;
            const ownerDisplayName = owner?.display_name ?? `Roster ${roster.roster_id}`;
            return {
              rosterId: roster.roster_id,
              ownerId: roster.owner_id,
              ownerDisplayName,
            };
          })
          .sort((a, b) => a.rosterId - b.rosterId);

      const toPlayer = (
        playerId: string,
        sleeperPlayer: SleeperCatalogPlayer | undefined,
      ): TeamViewPlayer => {
        const firstName = sleeperPlayer?.first_name ?? '';
        const lastName = sleeperPlayer?.last_name ?? '';
        const fullName =
          sleeperPlayer?.full_name?.trim() || `${firstName} ${lastName}`.trim() || playerId;
        const position = sleeperPlayer?.position ?? 'UNKNOWN';
        const age = sleeperPlayer?.age ?? null;
        const yearsExp = sleeperPlayer?.years_exp ?? null;
        const injuryStatus = sleeperPlayer?.injury_status ?? null;

        const ktcPlayer = ktcLookupCache.get(ratingService.normalizeName(fullName));

        return {
          playerId,
          fullName,
          firstName,
          lastName,
          position,
          team: sleeperPlayer?.team ?? null,
          age,
          yearsExp,
          injuryStatus,
          ktcValue: ktcPlayer?.value ?? null,
          ktcRank: ktcPlayer?.rank ?? null,
        };
      };

      const sortFuturePicks = (picks: DraftPick[]): DraftPick[] =>
        [...picks].sort((a, b) => {
          const seasonDelta = Number(a.season) - Number(b.season);
          if (seasonDelta !== 0) {
            return seasonDelta;
          }
          return a.round - b.round;
        });

      const applyRosterSelection = (rosterId: number): void => {
        const selectedRoster = rostersCache.find((roster) => roster.roster_id === rosterId);
        if (!selectedRoster) {
          patchState(store, {
            error: 'Selected roster is no longer available.',
            sections: emptySections(),
            rating: null,
            ratingWarning: null,
            selectedRosterId: null,
            loading: false,
          });
          return;
        }

        const starterSet = new Set(selectedRoster.starters ?? []);
        const reserveSet = new Set(selectedRoster.reserve ?? []);
        const allPlayerIds = selectedRoster.players ?? [];

        const starters = sortByValueDesc(
          Array.from(starterSet).map((playerId) =>
            toPlayer(playerId, playersByIdCache[playerId]),
          ),
        );

        const ir = sortByValueDesc(
          Array.from(reserveSet).map((playerId) => toPlayer(playerId, playersByIdCache[playerId])),
        );

        const bench = sortByValueDesc(
          allPlayerIds
            .filter((playerId) => !starterSet.has(playerId) && !reserveSet.has(playerId))
            .map((playerId) => toPlayer(playerId, playersByIdCache[playerId])),
        );

        const numericSeason = Number(seasonCache);
        const futurePicks = sortFuturePicks(
          (selectedRoster.picks ?? []).filter((pick) => Number(pick.season) >= numericSeason),
        );

        const allTeamPlayers = [...starters, ...bench, ...ir];
        const rating = ratingService.computeTeamRating(allTeamPlayers, ktcLookupCache);

        patchState(store, {
          sections: {
            starters,
            bench,
            ir,
            futurePicks,
          },
          selectedRosterId: rosterId,
          rating,
          ratingWarning: rating.ktcUnavailable
            ? 'KTC values are currently unavailable. Showing Sleeper-only fallback scoring.'
            : null,
          loading: false,
          error: null,
        });
      };

      const resetForNoLeague = (): void => {
        rostersCache = [];
        usersByIdCache = {};
        playersByIdCache = {};
        seasonCache = '';
        ktcLookupCache = new Map();
        patchState(store, {
          loading: false,
          error: null,
          selectedLeagueId: null,
          availableRosters: [],
          selectedRosterId: null,
          sections: emptySections(),
          rating: null,
          ratingWarning: null,
        });
      };

      const loadForLeague = async (leagueId: string, season: string): Promise<void> => {
        patchState(store, {
          loading: true,
          error: null,
          selectedLeagueId: leagueId,
          selectedRosterId: null,
          sections: emptySections(),
          rating: null,
          ratingWarning: null,
        });

        try {
          const isSuperflex = (appStore.selectedLeague()?.roster_positions ?? []).includes('SUPER_FLEX');
          const [rosters, users, playersById, ktcPlayers] = await firstValueFrom(
            forkJoin([
              sleeperService.getLeagueRosters(leagueId),
              sleeperService.getLeagueUsers(leagueId),
              sleeperService.getAllPlayers(),
              ratingService.fetchPlayers(isSuperflex),
            ]),
          );

          rostersCache = rosters;
          usersByIdCache = users.reduce<Record<string, LeagueUser>>((acc, user) => {
            acc[user.user_id] = user;
            return acc;
          }, {});
          playersByIdCache = playersById;
          ktcLookupCache = ratingService.buildNameLookup(ktcPlayers);
          seasonCache = season;

          const availableRosters = buildRosterOptions(rostersCache, usersByIdCache);
          patchState(store, { availableRosters });

          const currentUser = appStore.user();
          if (!currentUser) {
            patchState(store, { loading: false });
            return;
          }

          const matchedRoster = rostersCache.find(
            (roster) => roster.owner_id === currentUser.user_id,
          );

          if (!matchedRoster) {
            patchState(store, {
              loading: false,
              error:
                'No roster matched the selected user. Please select a roster manually.',
            });
            return;
          }

          applyRosterSelection(matchedRoster.roster_id);
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load team view data from Sleeper.',
          });
        }
      };

      const runLoadForSelectedLeague = async (): Promise<void> => {
        const selectedLeague = appStore.selectedLeague();
        if (!selectedLeague) {
          resetForNoLeague();
          return;
        }

        await loadForLeague(selectedLeague.league_id, selectedLeague.season);
      };

      return {
        async loadForSelectedLeague(): Promise<void> {
          await runLoadForSelectedLeague();
        },

        selectRoster(rosterId: number): void {
          patchState(store, { loading: true, error: null });
          applyRosterSelection(rosterId);
        },

        retry(): void {
          void runLoadForSelectedLeague();
        },
      };
    },
  ),
  withHooks((store, appStore = inject(AppStore)) => {
    let previousLeagueId: string | null = null;
    const storeWithMethods = store as typeof store & {
      loadForSelectedLeague: () => Promise<void>;
    };

    return {
      onInit(): void {
        effect(() => {
          const leagueId = appStore.selectedLeague()?.league_id ?? null;
          if (leagueId === previousLeagueId) {
            return;
          }

          previousLeagueId = leagueId;
          void storeWithMethods.loadForSelectedLeague();
        });
      },
    };
  }),
);
