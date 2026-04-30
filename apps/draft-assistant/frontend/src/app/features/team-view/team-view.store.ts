import { effect, inject } from "@angular/core";
import { patchState, signalStore, withHooks, withMethods, withState } from "@ngrx/signals";
import { firstValueFrom } from "rxjs";
import { KtcRatingService } from "../../core/adapters/ktc/ktc-rating.service";
import { SleeperService } from "../../core/adapters/sleeper/sleeper.service";
import {
  DraftPlayerRow,
  DraftPick,
  KtcPlayer,
  LeagueRoster,
  LeagueStandingEntry,
  LeagueUser,
  SleeperCatalogPlayer,
  TeamViewPlayer,
  TeamViewRating,
  TeamViewRosterOption,
  TeamViewRosterSections,
} from "../../core/models";
import { PlayerNormalizationService } from "../../core/services/player-normalization.service";
import { AppStore } from "../../core/state/app.store";
import { toErrorMessage } from "../../core/utils/error.util";
import { toMapById } from "../../core/utils/array-mapping.util";
import { buildFullName } from "../../core/utils/player-name.util";

interface TeamViewState {
  loading: boolean;
  error: string | null;
  selectedLeagueId: string | null;
  availableRosters: TeamViewRosterOption[];
  selectedRosterId: number | null;
  sections: TeamViewRosterSections;
  rating: TeamViewRating | null;
  ratingWarning: string | null;
  leagueStandings: LeagueStandingEntry[];
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
    leagueStandings: [],
  }),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      sleeperService = inject(SleeperService),
      ratingService = inject(KtcRatingService),
      playerNormalizationService = inject(PlayerNormalizationService),
    ) => {
      let rostersCache: LeagueRoster[] = [];
      let usersByIdCache: Record<string, LeagueUser> = {};
      let playersByIdCache: Record<string, SleeperCatalogPlayer> = {};
      let seasonCache = "";
      let ktcLookupCache: Map<string, KtcPlayer> = new Map();
      let normalizedPlayersByIdCache: Record<string, DraftPlayerRow> = {};

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
        const firstName = sleeperPlayer?.first_name ?? "";
        const lastName = sleeperPlayer?.last_name ?? "";
        const fullName =
          sleeperPlayer?.full_name?.trim() || buildFullName(firstName, lastName) || playerId;
        const position = sleeperPlayer?.position ?? "UNKNOWN";
        const age = sleeperPlayer?.age ?? null;
        const yearsExp = sleeperPlayer?.years_exp ?? null;
        const injuryStatus = sleeperPlayer?.injury_status ?? null;
        const normalizedPlayer = normalizedPlayersByIdCache[playerId];

        return {
          playerId,
          fullName,
          firstName,
          lastName,
          position,
          team: sleeperPlayer?.team ?? null,
          age,
          college: sleeperPlayer?.college ?? null,
          rookie: normalizedPlayer?.rookie ?? false,
          rookieYear: sleeperPlayer?.rookie_year ?? null,
          yearsExp,
          injuryStatus,
          ktcValue: normalizedPlayer?.ktcValue ?? null,
          ktcRank: normalizedPlayer?.ktcRank ?? null,
          ktcPositionalRank: normalizedPlayer?.ktcPositionalRank ?? null,
          ktcOverallTier: normalizedPlayer?.overallTier ?? null,
          ktcPositionalTier: normalizedPlayer?.positionalTier ?? null,
          sleeperRank: normalizedPlayer?.sleeperRank ?? null,
          flockAverageTier: normalizedPlayer?.flockAverageTier ?? null,
          flockAveragePositionalTier: normalizedPlayer?.flockAveragePositionalTier ?? null,
          flockAveragePositionalRank: normalizedPlayer?.flockAveragePositionalRank ?? null,
          averageRank: normalizedPlayer?.averageRank ?? null,
          combinedTier: normalizedPlayer?.combinedTier ?? null,
          combinedPositionalTier: normalizedPlayer?.combinedPositionalTier ?? null,
          adpRank: normalizedPlayer?.adpRank ?? null,
          adpDelta: normalizedPlayer?.adpDelta ?? null,
          valueGap: normalizedPlayer?.valueGap ?? null,
          fpAdpRank: normalizedPlayer?.fpAdpRank ?? null,
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

      const computeLeagueStandings = (): LeagueStandingEntry[] => {
        const entries = rostersCache.map((roster) => {
          const uniquePlayerIds = [...new Set(roster.players ?? [])];
          const players = uniquePlayerIds.map((id) => toPlayer(id, playersByIdCache[id]));
          const rating = ratingService.computeTeamRating(players, ktcLookupCache);
          const owner = roster.owner_id ? usersByIdCache[roster.owner_id] : undefined;
          return {
            rosterId: roster.roster_id,
            ownerDisplayName: owner?.display_name ?? `Roster ${roster.roster_id}`,
            combinedScore: rating.combinedScore,
            positionScores: rating.positionScores,
            rank: 0,
          };
        });
        return entries
          .sort((a, b) => b.combinedScore - a.combinedScore)
          .map((entry, i) => ({ ...entry, rank: i + 1 }));
      };

      const applyRosterSelection = (rosterId: number): void => {
        const selectedRoster = rostersCache.find((roster) => roster.roster_id === rosterId);
        if (!selectedRoster) {
          patchState(store, {
            error: "Selected roster is no longer available.",
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
          Array.from(starterSet).map((playerId) => toPlayer(playerId, playersByIdCache[playerId])),
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
            ? "KTC values are currently unavailable. Showing Sleeper-only fallback scoring."
            : null,
          loading: false,
          error: null,
        });
      };

      const resetForNoLeague = (): void => {
        rostersCache = [];
        usersByIdCache = {};
        playersByIdCache = {};
        seasonCache = "";
        ktcLookupCache = new Map();
        normalizedPlayersByIdCache = {};
        patchState(store, {
          loading: false,
          error: null,
          selectedLeagueId: null,
          availableRosters: [],
          selectedRosterId: null,
          sections: emptySections(),
          rating: null,
          ratingWarning: null,
          leagueStandings: [],
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
          const isSuperflex = (appStore.selectedLeague()?.roster_positions ?? []).includes(
            "SUPER_FLEX",
          );
          const [rosters, users, playersById, ktcPlayers, normalizedPlayers] = await Promise.all([
            firstValueFrom(sleeperService.getLeagueRosters(leagueId)),
            firstValueFrom(sleeperService.getLeagueUsers(leagueId)),
            firstValueFrom(sleeperService.getAllPlayers()),
            firstValueFrom(ratingService.fetchPlayers(isSuperflex)),
            playerNormalizationService.buildPlayerRows({
              format: { isSuperflex, isRookie: false },
              season: Number(season),
              sources: ["ktc", "flock", "fpAdp"],
            }),
          ]);

          rostersCache = rosters;
          usersByIdCache = toMapById(users, "user_id");
          playersByIdCache = playersById;
          ktcLookupCache = ratingService.buildNameLookup(ktcPlayers);
          seasonCache = season;

          normalizedPlayersByIdCache = Object.fromEntries(
            normalizedPlayers.map((player) => [player.playerId, player]),
          ) as Record<string, DraftPlayerRow>;

          const availableRosters = buildRosterOptions(rostersCache, usersByIdCache);
          const leagueStandings = computeLeagueStandings();
          patchState(store, { availableRosters, leagueStandings });

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
              error: "No roster matched the selected user. Please select a roster manually.",
            });
            return;
          }

          applyRosterSelection(matchedRoster.roster_id);
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error: toErrorMessage(error, "Failed to load team view data from Sleeper."),
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
