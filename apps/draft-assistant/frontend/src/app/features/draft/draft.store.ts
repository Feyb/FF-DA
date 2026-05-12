import { computed, effect, inject } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from "@ngrx/signals";
import { forkJoin, firstValueFrom, of } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from "rxjs/operators";
import { isSleeperRookieDraft } from "../../core/adapters/sleeper/sleeper-draft.util";
import { SleeperService } from "../../core/adapters/sleeper/sleeper.service";
import {
  DraftPlayerRow,
  DraftRecommendation,
  LeagueRoster,
  LeagueUser,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
  TierSource,
} from "../../core/models";
import { mapRosterAvatarIds } from "./draft-board-grid/draft-board-grid.util";
import { AppStore } from "../../core/state/app.store";
import { StorageService } from "../../core/services/storage.service";
import { PlayerNormalizationService } from "../../core/services/player-normalization.service";
import {
  ConsensusAggregatorService,
  ConsensusInput,
} from "../../core/services/consensus-aggregator.service";
import { SurvivalService } from "../../core/services/survival.service";
import { NflverseService } from "../../core/adapters/nflverse/nflverse.service";
import { CfbdService, normalizeCfbdName } from "../../core/adapters/cfbd/cfbd.service";
import { DraftMcService, McSimRequest } from "../../core/services/draft-mc.service";
import { buildRookieScoreMap, RookieScoreInputs } from "./utils/rookie-score.util";
import { computeTierCliff, TierCliffPlayer } from "./tier-cliff.util";
import { generateExplanation } from "./score-explanation.util";
import { buildEffScoreInputs, computeEffScores } from "./utils/efficiency-score.util";
import { buildContextModMap, ContextModInputs } from "./utils/context-mod.util";
import { buildSchemeFitMap, SchemeFitInputs } from "./utils/scheme-fit.util";
import { computeVnp, VnpPlayer } from "./utils/vnp.util";
import {
  computeRunHeat,
  countRecentPositionPicks,
  POSITION_RUN_WINDOW,
} from "./utils/board-state.util";
import { toErrorMessage } from "../../core/utils/error.util";
import { togglePositionFilter } from "../../core/utils/position-filter.util";
import { toMapById } from "../../core/utils/array-mapping.util";
import { DraftValueSource, resolveDraftTier, resolveDraftValue } from "./draft-ranking.util";
import {
  DraftSortSource,
  positionalRankForSortSource,
  rankForSortSource,
  sortBySortSource,
} from "./draft-sort.util";
import { DraftMode, DRAFT_MODE_LABELS, NEED_WEIGHTS, SOURCE_WEIGHTS } from "./config/mode-weights";

export type DraftPositionFilter = "QB" | "RB" | "WR" | "TE";
export type DraftSourceMode = "league" | "direct";
export type { DraftMode, DraftSortSource, DraftValueSource };
export { DRAFT_MODE_LABELS };

export { positionalRankForSortSource, rankForSortSource };

/** A DraftPlayerRow enriched with runtime draft-session state for UI display. */
export interface DraftPlayerDisplayRow extends DraftPlayerRow {
  isDrafted: boolean;
  availabilityRisk: "safe" | "at-risk" | "gone";
  isGoingSoon: boolean;
}

/** Best-available entry for one position (REQ-BA-01 to REQ-BA-08). */
export interface BestAvailableEntry {
  position: DraftPositionFilter;
  player: DraftPlayerRow | null;
  lowestAvailableTier: number | null;
  availabilityRisk: "safe" | "at-risk" | "gone";
}

/** Tier drop alert (REQ-TD-01 to REQ-TD-07). */
export interface TierDropAlert {
  id: string;
  position: DraftPositionFilter;
  droppedTier: number;
  nextTier: number | null;
  createdAt: number;
}

/** Per-position roster need entry (REQ-PN-01 to REQ-PN-08). */
export interface PositionalNeedEntry {
  position: string;
  configured: number;
  filled: number;
  remaining: number;
}

interface SelectDraftOptions {
  rookieHint?: boolean;
  source?: DraftSourceMode;
}

interface DraftState {
  loading: boolean;
  error: string | null;
  staleData: boolean;
  selectedLeagueId: string | null;
  draftSource: DraftSourceMode | null;
  drafts: SleeperDraft[];
  selectedDraftId: string | null;
  draftStatus: string | null;
  rosterDisplayNames: Record<string, string>;
  rosterAvatarIds: Record<string, string | null>;
  playerNameMap: Record<string, string>;
  picks: SleeperDraftPick[];
  tradedPicks: SleeperTradedPick[];
  rows: DraftPlayerRow[];
  selectedPositions: DraftPositionFilter[];
  rookiesOnly: boolean;
  starredPlayerIds: string[];
  lastUpdatedAt: number | null;
  tierSource: TierSource;
  valueSource: DraftValueSource;
  sortSource: DraftSortSource;
  /** Search query for player list filtering (REQ-SN-01). */
  searchQuery: string;
  /** When true, show only positions with remaining roster slots (REQ-PL-11). */
  neededPositionsOnly: boolean;
  /** Active tier-drop alerts (REQ-TD-01 to REQ-TD-07). */
  tierDropAlerts: TierDropAlert[];
  /** Draft mode controls source weights, ContextMod severity, and NeedMultiplier params. */
  draftMode: DraftMode;
  /** Player IDs already on the user's dynasty roster before this draft started. */
  existingRosterPlayerIds: string[];
  /** Sleeper player ID currently shown in the detail drawer; null = closed. */
  selectedDetailPlayerId: string | null;
}

const DEFAULT_POSITIONS: DraftPositionFilter[] = ["QB", "RB", "WR", "TE"];
const BEST_AVAILABLE_POSITIONS: DraftPositionFilter[] = ["QB", "RB", "WR", "TE"];
const DRAFT_MODE_STORAGE_KEY = "draftAssistant.draftMode";
const VALID_DRAFT_MODES: DraftMode[] = ["startup", "rookie", "redraft"];

function isDraftMode(value: unknown): value is DraftMode {
  return VALID_DRAFT_MODES.includes(value as DraftMode);
}

/** Compute how many picks until the user's turn (0 = user's pick now). */
function calcPicksUntilMyTurn(currentPickNumber: number, userSlot: number, teams: number): number {
  const currentRound = Math.floor((currentPickNumber - 1) / teams);
  const pickInRound = ((currentPickNumber - 1) % teams) + 1;
  const userPickInRound = currentRound % 2 === 0 ? userSlot : teams - userSlot + 1;
  if (pickInRound <= userPickInRound) {
    return userPickInRound - pickInRound;
  }
  const nextRound = currentRound + 1;
  const nextRoundUserPick = nextRound % 2 === 0 ? userSlot : teams - userSlot + 1;
  return teams - pickInRound + nextRoundUserPick;
}

/** Count configured and filled roster slots from existing dynasty players + current draft picks. */
function buildRosterFillInfo(
  rosterPositions: string[],
  picks: SleeperDraftPick[],
  userRosterId: number | null,
  rows: DraftPlayerRow[],
  existingRosterPlayerIds: string[],
): { configuredByPos: Record<string, number>; filledByPos: Record<string, number> } {
  const configuredByPos: Record<string, number> = {};
  for (const slot of rosterPositions) {
    if (slot === "BN" || slot === "IR") continue;
    configuredByPos[slot] = (configuredByPos[slot] ?? 0) + 1;
  }
  const playerPositionById = new Map(rows.map((row) => [row.playerId, row.position] as const));
  const filledByPos: Record<string, number> = {};
  const countedIds = new Set<string>();
  // Seed with players already on the dynasty roster before this draft.
  for (const playerId of existingRosterPlayerIds) {
    const pos = playerPositionById.get(playerId) ?? null;
    if (pos) {
      filledByPos[pos] = (filledByPos[pos] ?? 0) + 1;
      countedIds.add(playerId);
    }
  }
  // Add players picked in this draft session, skipping keepers already seeded above.
  if (userRosterId !== null) {
    for (const pick of picks) {
      if (pick.roster_id !== userRosterId || countedIds.has(pick.player_id)) continue;
      const pos = playerPositionById.get(pick.player_id) ?? null;
      if (pos) filledByPos[pos] = (filledByPos[pos] ?? 0) + 1;
    }
  }
  return { configuredByPos, filledByPos };
}

/** Generate a unique alert ID without module-level mutable state. */
function generateAlertId(position: string, tier: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `tier-drop-${crypto.randomUUID()}`;
  }
  return `tier-drop-${Date.now()}-${Math.random().toString(36).slice(2)}-${position}-${tier}`;
}

export const DraftStore = signalStore(
  withState<DraftState>({
    loading: false,
    error: null,
    staleData: false,
    selectedLeagueId: null,
    draftSource: null,
    drafts: [],
    selectedDraftId: null,
    draftStatus: null,
    rosterDisplayNames: {},
    rosterAvatarIds: {},
    playerNameMap: {},
    picks: [],
    tradedPicks: [] as SleeperTradedPick[],
    rows: [],
    selectedPositions: DEFAULT_POSITIONS,
    rookiesOnly: false,
    starredPlayerIds: [],
    lastUpdatedAt: null,
    tierSource: "ktc",
    valueSource: "ktcValue",
    sortSource: "combinedTier" as DraftSortSource,
    searchQuery: "",
    neededPositionsOnly: false,
    tierDropAlerts: [],
    draftMode: "startup" as DraftMode,
    existingRosterPlayerIds: [] as string[],
    selectedDetailPlayerId: null as string | null,
  }),
  withComputed((store, appStore = inject(AppStore)) => ({
    selectedDraft: computed(
      () => store.drafts().find((d) => d.draft_id === store.selectedDraftId()) ?? null,
    ),
    pickedPlayerIds: computed(() => {
      const ids = new Set<string>();
      for (const pick of store.picks()) {
        if (pick.player_id) {
          ids.add(pick.player_id);
        }
      }
      return ids;
    }),

    /**
     * Derive the user's roster_id from draft_order and slot_to_roster_id.
     * Used to identify "my picks" (REQ-SM-04, REQ-SM-05).
     */
    userRosterId: computed((): number | null => {
      const userId = appStore.user()?.user_id;
      const draft = store.drafts().find((d) => d.draft_id === store.selectedDraftId()) ?? null;
      if (!userId || !draft) return null;
      const userSlot = draft.draft_order?.[userId];
      if (!userSlot || typeof userSlot !== "number") return null;
      const rosterId = draft.slot_to_roster_id?.[String(userSlot)];
      return typeof rosterId === "number" ? rosterId : null;
    }),

    /**
     * Next pick number for the current user in a snake draft (REQ-PA-02, REQ-PA-03).
     */
    userNextPickNumber: computed((): number | null => {
      const userId = appStore.user()?.user_id;
      const draft = store.drafts().find((d) => d.draft_id === store.selectedDraftId()) ?? null;
      if (!userId || !draft) return null;
      const userSlot = draft.draft_order?.[userId];
      if (!userSlot || typeof userSlot !== "number" || userSlot <= 0) return null;
      const teams = draft.settings?.["teams"];
      if (!teams || typeof teams !== "number" || teams <= 0) return null;

      const currentPickNumber = store.picks().length + 1;
      const picksUntil = calcPicksUntilMyTurn(currentPickNumber, userSlot, teams);
      return currentPickNumber + picksUntil;
    }),
  })),

  // Weighted Composite Score pipeline. Runs before the general player-row
  // computeds so enrichedRows (back-filled WCS fields) is available downstream.
  //
  // Pipeline:
  //   1. BaseValue — mode-weighted z-mean consensus across up to 5 sources, 0-100.
  //   2. pAvailAtNext — ADP Normal CDF survival probability.
  //   3. TierCliff — Jenks-clustered expected loss-of-waiting.
  //   4. NeedMultiplier — roster-aware position need, clamped [0.5, 1.6].
  //   5. RunHeat — trailing-window position-run signal, [-0.1, +0.2].
  //   6. EffScore — position-specific nflverse composite (WOPR/YPRR/TPRR/EPA/CPOE).
  //   7. ContextMod — AgeMult × CapitalMult × EffMult × SchemeFit(stub=1).
  //   8. VNP — Value over Next Pick via ADP survival.
  //   9. WCS = BaseValue × ContextMod × NeedMult × (1 + cliff + valueDelta + runHeat + vnp).
  withComputed(
    (
      store,
      aggregator = inject(ConsensusAggregatorService),
      survival = inject(SurvivalService),
      appStore = inject(AppStore),
      nflverse = inject(NflverseService),
      cfbd = inject(CfbdService),
      mcService = inject(DraftMcService),
      sleeperService = inject(SleeperService),
    ) => {
      // Nflverse data signals — load once, shareReplay(1) inside the service.
      const playerStatsMap = toSignal(nflverse.playerStats$, {
        initialValue: new Map(),
      });

      // CFBD rookie metrics keyed by normalized player name.
      const cfbdMetricsByName = toSignal(cfbd.rookieMetricsByName$, { initialValue: new Map() });

      // Sleeper trending adds — top 100 most-added players in last 24 h.
      // catchError so a Sleeper outage never crashes the WCS pipeline.
      const trendingRaw = toSignal(
        sleeperService.getTrendingPlayers("add", 100).pipe(catchError(() => of([]))),
        { initialValue: [] as { player_id: string; count: number }[] },
      );
      const trendingTopTenMap = computed((): Map<string, number> => {
        const out = new Map<string, number>();
        for (const { player_id, count } of trendingRaw().slice(0, 10)) {
          out.set(player_id, count);
        }
        return out;
      });
      const pfrStatsMap = toSignal(nflverse.pfrAdvStats$, { initialValue: new Map() });
      const ngsStatsMap = toSignal(nflverse.ngsStats$, { initialValue: new Map() });
      const ffOppMap = toSignal(nflverse.ffOpportunity$, { initialValue: new Map() });
      const draftPicksMap = toSignal(nflverse.draftPicks$, { initialValue: new Map() });
      const rostersMap = toSignal(nflverse.rosters$, { initialValue: new Map() });

      // Bridge: normalized full_name → GSIS player_id (for player-detail drawer nflverse lookups).
      const nflverseGsisIdByName = computed((): Map<string, string> => {
        const m = new Map<string, string>();
        for (const r of rostersMap().values()) {
          if (r.full_name) m.set(normalizeCfbdName(r.full_name), r.player_id);
        }
        return m;
      });
      const baseValueByPlayer = computed(
        (): Map<string, { baseValue: number | null; divergence: number | null }> => {
          const weights = SOURCE_WEIGHTS[store.draftMode()];
          const inputs: ConsensusInput[] = [];
          for (const row of store.rows()) {
            const sources: ConsensusInput["sources"] = [];
            if (row.ktcRank !== null) sources.push({ source: "ktc", rank: row.ktcRank });
            if (row.averageRank !== null) sources.push({ source: "flock", rank: row.averageRank });
            if (row.flockRookieRank !== null)
              sources.push({ source: "flockRookie", rank: row.flockRookieRank });
            if (row.fantasyCalcValue !== null)
              sources.push({ source: "fantasycalc", value: row.fantasyCalcValue });
            if (row.fpAdpRank !== null) sources.push({ source: "fpAdp", rank: row.fpAdpRank });
            if (row.adpMean !== null) sources.push({ source: "ffcAdp", rank: row.adpMean });
            if (sources.length === 0) continue;
            inputs.push({ playerId: row.playerId, position: row.position, sources });
          }
          const consensus = aggregator.aggregate(inputs, { weights });
          const out = new Map<string, { baseValue: number | null; divergence: number | null }>();
          for (const [pid, c] of consensus) {
            out.set(pid, { baseValue: c.baseValue, divergence: c.divergence });
          }
          return out;
        },
      );

      const pAvailAtNextByPlayer = computed((): Map<string, number> => {
        const result = new Map<string, number>();
        const userNext = store.userNextPickNumber();
        if (userNext === null) return result;
        for (const row of store.rows()) {
          const mean = row.adpMean;
          if (mean === null) continue;
          const std = row.adpStd ?? survival.estimateSigma(mean);
          result.set(row.playerId, survival.pAvailableAt(userNext, mean, std));
        }
        return result;
      });

      const tierCliffByPlayer = computed(
        (): Map<
          string,
          { cliff: number; tier: number; thisMean: number; nextMean: number | null }
        > => {
          const baseMap = baseValueByPlayer();
          const pAvailMap = pAvailAtNextByPlayer();
          const tcInputs: TierCliffPlayer[] = [];
          for (const row of store.rows()) {
            const bv = baseMap.get(row.playerId)?.baseValue ?? null;
            if (bv === null) continue;
            tcInputs.push({
              playerId: row.playerId,
              position: row.position,
              baseValue: bv,
              pAvailAtNext: pAvailMap.get(row.playerId) ?? null,
            });
          }
          const { tierByPlayer, tierCliffByPlayer: cliffByPlayer } = computeTierCliff(tcInputs);
          const out = new Map<
            string,
            { cliff: number; tier: number; thisMean: number; nextMean: number | null }
          >();
          for (const [pid, t] of tierByPlayer) {
            out.set(pid, {
              cliff: cliffByPlayer.get(pid) ?? 0,
              tier: t.tier,
              thisMean: t.meanBaseValue,
              nextMean: t.nextTierMeanBaseValue,
            });
          }
          return out;
        },
      );

      // Maps NFL team code → QB name on the user's current roster (existing + session picks).
      // Shared between NeedMultiplier (γ stack-synergy) and wcsExplanationByPlayer (#12 template).
      const userQbByTeam = computed((): Map<string, string> => {
        const rowByPlayerId = new Map(store.rows().map((r) => [r.playerId, r]));
        const out = new Map<string, string>();
        for (const pid of store.existingRosterPlayerIds()) {
          const r = rowByPlayerId.get(pid);
          if (r?.position === "QB" && r.team) out.set(r.team, r.fullName);
        }
        const userRosterId = store.userRosterId();
        if (userRosterId !== null) {
          for (const pick of store.picks()) {
            if (pick.roster_id !== userRosterId || !pick.player_id) continue;
            const r = rowByPlayerId.get(pick.player_id);
            if (r?.position === "QB" && r.team) out.set(r.team, r.fullName);
          }
        }
        return out;
      });

      // Counts the user's drafted picks per bye week.
      // Shared between NeedMultiplier (δ bye-cluster penalty) and wcsExplanationByPlayer (#14 template).
      const userByeWeekCounts = computed((): Map<number, number> => {
        const rowByPlayerId = new Map(store.rows().map((r) => [r.playerId, r]));
        const userRosterId = store.userRosterId();
        const out = new Map<number, number>();
        if (userRosterId !== null) {
          for (const pick of store.picks()) {
            if (pick.roster_id !== userRosterId || !pick.player_id) continue;
            const r = rowByPlayerId.get(pick.player_id);
            if (r?.byeWeek != null) {
              out.set(r.byeWeek, (out.get(r.byeWeek) ?? 0) + 1);
            }
          }
        }
        return out;
      });

      // NeedMultiplier: roster-aware position need score per player.
      // Formula: clamp(1 + α·unfilledGap − β·stackedPenalty + γ·stackSynergy − δ·byeCluster, 0.5, 1.6)
      const needMultiplierByPlayer = computed((): Map<string, number> => {
        const mode = store.draftMode();
        const { alpha, beta, gamma, delta } = NEED_WEIGHTS[mode];
        const league = appStore.selectedLeague();
        const rosterPositions = league?.roster_positions ?? [];
        const { configuredByPos, filledByPos } = buildRosterFillInfo(
          rosterPositions,
          store.picks(),
          store.userRosterId(),
          store.rows(),
          store.existingRosterPlayerIds(),
        );

        const byeWeekCounts = userByeWeekCounts();
        const qbByTeam = userQbByTeam();

        const out = new Map<string, number>();
        for (const row of store.rows()) {
          const pos = row.position;
          const configured = configuredByPos[pos] ?? 0;
          if (configured === 0) {
            out.set(row.playerId, 1.0);
            continue;
          }
          const filled = filledByPos[pos] ?? 0;
          // UnfilledStarterGap: how far below the required starters we are.
          const unfilledGap = Math.max(0, configured - filled) / configured;
          // StackedPenalty: how far above (configured + 1 bench) we are.
          const stackedPenalty = Math.max(0, filled - (configured + 1)) / configured;
          // "Pass-catcher" includes RB: QB-RB stacks are a real dynasty strategy.
          const stackSynergy =
            gamma > 0 && row.position !== "QB" && row.team && qbByTeam.has(row.team) ? 1 : 0;
          const byeCluster =
            delta > 0 && row.byeWeek != null && (byeWeekCounts.get(row.byeWeek) ?? 0) >= 3 ? 1 : 0;
          const raw =
            1 +
            alpha * unfilledGap -
            beta * stackedPenalty +
            gamma * stackSynergy -
            delta * byeCluster;
          out.set(row.playerId, Math.max(0.5, Math.min(1.6, raw)));
        }
        return out;
      });

      // RunHeat: soft signal for when a position run is actively happening.
      // Extracted to board-state.util.ts; tanh-clamped to [-0.1, +0.2].
      const runHeatByPlayer = computed((): Map<string, number> => {
        const posByPlayerId = new Map(store.rows().map((r) => [r.playerId, r.position]));
        return computeRunHeat(
          store.picks(),
          posByPlayerId,
          store.rows().map((r) => r.playerId),
        );
      });

      // EffScore: position-specific composite from nflverse data (WOPR/YPRR/etc.).
      // Returns null for players with < 6 games (insufficient sample).
      const effScoreByPlayer = computed((): Map<string, number | null> => {
        const rows = store.rows();
        if (rows.length === 0) return new Map();
        const positions = new Map(rows.map((r) => [r.playerId, r.position]));
        const inputs = buildEffScoreInputs(
          rows.map((r) => r.playerId),
          positions,
          playerStatsMap(),
          pfrStatsMap(),
          ngsStatsMap(),
          ffOppMap(),
        );
        return computeEffScores(inputs);
      });

      // SchemeFit: positional archetype vs OC tendency profile.
      const schemeFitByPlayer = computed((): Map<string, number> => {
        const rows = store.rows();
        if (rows.length === 0) return new Map();
        const inputs: SchemeFitInputs[] = rows.map((row) => ({
          playerId: row.playerId,
          position: row.position,
          team: row.team,
          aDot: null,
          snapShare: null,
          depthChartOrder: null,
        }));
        return buildSchemeFitMap(inputs);
      });

      // RookieScore: capital + CFBD composite for yearsExp ≤ 2 in rookie/startup mode.
      const rookieScoreByPlayer = computed((): Map<string, number | null> => {
        const rows = store.rows();
        if (rows.length === 0) return new Map();
        const cfbdMap = cfbdMetricsByName();
        const picksMap = draftPicksMap();
        const inputs: RookieScoreInputs[] = rows.map((row) => ({
          playerId: row.playerId,
          position: row.position,
          nflRound: picksMap.get(row.playerId)?.round ?? null,
          yearsExp: row.yearsExp,
          cfbd: cfbdMap.get(normalizeCfbdName(row.fullName)) ?? null,
        }));
        return buildRookieScoreMap(inputs);
      });

      // ContextMod: AgeMult × CapitalMult × EffMult × SchemeFitMult.
      const contextModByPlayer = computed((): Map<string, number> => {
        const effMap = effScoreByPlayer();
        const schemeMap = schemeFitByPlayer();
        const picksMap = draftPicksMap();
        const mode = store.draftMode();
        const inputs: ContextModInputs[] = store.rows().map((row) => ({
          playerId: row.playerId,
          position: row.position,
          age: row.age,
          nflRound: picksMap.get(row.playerId)?.round ?? null,
          yearsExp: row.yearsExp,
          effScore: effMap.get(row.playerId) ?? null,
          schemeFit: schemeMap.get(row.playerId) ?? null,
        }));
        return buildContextModMap(inputs, mode);
      });

      // VNP: Value over Next Pick — how much better this player is vs what's
      // likely still available at the user's next pick.
      const vnpByPlayer = computed((): Map<string, number> => {
        const baseMap = baseValueByPlayer();
        const nextPickN = store.userNextPickNumber();
        if (nextPickN === null) return new Map();
        const undrafted: VnpPlayer[] = store
          .rows()
          .filter((r) => !store.pickedPlayerIds().has(r.playerId))
          .map((r) => ({
            playerId: r.playerId,
            position: r.position,
            projection: baseMap.get(r.playerId)?.baseValue ?? null,
            adpMean: r.adpMean,
            adpStd: r.adpStd,
          }));
        const pAvailFn = (pickN: number, mean: number, std: number): number =>
          survival.pAvailableAt(pickN, mean, std);
        return computeVnp(undrafted, nextPickN, pAvailFn);
      });

      const weightedCompositeByPlayer = computed((): Map<string, number> => {
        const baseMap = baseValueByPlayer();
        const cliffMap = tierCliffByPlayer();
        const pAvailMap = pAvailAtNextByPlayer();
        const needMap = needMultiplierByPlayer();
        const runMap = runHeatByPlayer();
        const ctxMap = contextModByPlayer();
        const vnpMap = vnpByPlayer();
        const out = new Map<string, number>();
        for (const row of store.rows()) {
          const bv = baseMap.get(row.playerId)?.baseValue;
          if (bv === null || bv === undefined) continue;
          const cliffRaw = cliffMap.get(row.playerId)?.cliff ?? 0;
          const cliffNorm = bv > 0 ? Math.min(1, cliffRaw / bv) : 0;
          const pAvail = pAvailMap.get(row.playerId);
          const valueDeltaNorm = pAvail === undefined ? 0 : Math.max(0, 1 - pAvail) * 0.2;
          const runHeat = runMap.get(row.playerId) ?? 0;
          const vnp = vnpMap.get(row.playerId) ?? 0;
          const needMult = needMap.get(row.playerId) ?? 1.0;
          const contextMod = ctxMap.get(row.playerId) ?? 1.0;
          out.set(
            row.playerId,
            bv * contextMod * needMult * (1 + cliffNorm + valueDeltaNorm + runHeat + vnp),
          );
        }
        return out;
      });

      const wcsExplanationByPlayer = computed((): Map<string, string> => {
        const baseMap = baseValueByPlayer();
        const cliffMap = tierCliffByPlayer();
        const pAvailMap = pAvailAtNextByPlayer();
        const needMap = needMultiplierByPlayer();
        const effMap = effScoreByPlayer();
        const vnpMap = vnpByPlayer();
        const picksMap = draftPicksMap();
        const currentPickNumber = store.picks().length + 1;

        const posByPlayerId = new Map(store.rows().map((r) => [r.playerId, r.position]));
        const recentPositions = countRecentPositionPicks(store.picks(), posByPlayerId) as Record<
          "QB" | "RB" | "WR" | "TE",
          number
        >;

        // #12 StackSynergy — reuse the shared QB-by-team signal.
        const qbByTeam = userQbByTeam();
        // #14 ByeWeekCluster — reuse the shared bye-week histogram signal.
        const byeWeekCounts = userByeWeekCounts();
        const { delta } = NEED_WEIGHTS[store.draftMode()];
        const trendingMap = trendingTopTenMap();

        const out = new Map<string, string>();
        for (const row of store.rows()) {
          const base = baseMap.get(row.playerId);
          if (!base || base.baseValue === null) continue;
          const tierInfo = cliffMap.get(row.playerId);
          const effScore = effMap.get(row.playerId) ?? null;
          const playerStats = playerStatsMap().get(row.playerId);
          const stackSynergyQbName =
            row.position !== "QB" && row.team ? (qbByTeam.get(row.team) ?? null) : null;
          const byeWeekCluster =
            delta > 0 && row.byeWeek != null && (byeWeekCounts.get(row.byeWeek) ?? 0) >= 3;
          const explanation = generateExplanation({
            baseValue: base.baseValue,
            baseValueDivergence: base.divergence,
            pAvailAtNext: pAvailMap.get(row.playerId) ?? null,
            tierCliffScore: tierInfo?.cliff ?? null,
            nextTierMeanBaseValue: tierInfo?.nextMean ?? null,
            thisTierMeanBaseValue: tierInfo?.thisMean ?? null,
            tier: tierInfo?.tier ?? null,
            adpDelta: row.adpDelta,
            adpMean: row.adpMean,
            currentPickNumber,
            age: row.age,
            position: row.position,
            positionRunCount: recentPositions[row.position] ?? 0,
            positionRunWindow: POSITION_RUN_WINDOW,
            needMultiplier: needMap.get(row.playerId) ?? 1.0,
            draftMode: store.draftMode(),
            nflRound: picksMap.get(row.playerId)?.round ?? null,
            effScore,
            effDisplayStats:
              effScore !== null
                ? {
                    wopr: playerStats?.wopr,
                    cpoe: ngsStatsMap().get(row.playerId)?.cpoe,
                    weightedOpportunity: ffOppMap().get(row.playerId)?.weighted_opportunity,
                    yprr: pfrStatsMap().get(row.playerId)?.yprr,
                  }
                : null,
            vnp: vnpMap.get(row.playerId) ?? null,
            stackSynergyQbName,
            byeWeekCluster,
            trendingAdds: trendingMap.get(row.playerId) ?? null,
            injuryStatus: row.injuryStatus,
          });
          if (explanation) out.set(row.playerId, explanation);
        }
        return out;
      });

      // MC tie-break: when the top-3 WCS scores are within 2 pts, simulate 1 000
      // drafts to estimate each player's P(still on board at userNextPick).
      // Also include the currently selected detail player so the drawer can show
      // MC Survival even when tie-break mode is not active.
      const mcTriggerSignal = computed((): McSimRequest | null => {
        const wcsMap = weightedCompositeByPlayer();
        const nextPickN = store.userNextPickNumber();
        const currentPickN = store.picks().length;
        if (nextPickN === null || nextPickN <= currentPickN + 1) return null;

        const draftedIds = new Set(store.picks().map((p) => p.player_id));
        const rows = store.rows();

        // Exclude already-drafted players from both the candidate set and simulation pool.
        const undrafted = rows.filter((r) => {
          if (draftedIds.has(r.playerId)) return false;
          const wcs = wcsMap.get(r.playerId);
          return wcs !== null && wcs !== undefined;
        });
        undrafted.sort(
          (a, b) => (wcsMap.get(b.playerId) ?? -Infinity) - (wcsMap.get(a.playerId) ?? -Infinity),
        );

        const top3 = undrafted.slice(0, 3);
        const selectedDetailPlayerId = store.selectedDetailPlayerId();
        const selectedInPool =
          selectedDetailPlayerId !== null &&
          undrafted.some((r) => r.playerId === selectedDetailPlayerId);

        const tieBreakTargets =
          top3.length >= 2
            ? (() => {
                const maxWcs = wcsMap.get(top3[0].playerId) ?? 0;
                const minWcs = wcsMap.get(top3[top3.length - 1].playerId) ?? 0;
                return maxWcs - minWcs <= 2 ? top3.map((r) => r.playerId) : [];
              })()
            : [];

        const targetPlayerIds = new Set<string>(tieBreakTargets);
        if (selectedInPool && selectedDetailPlayerId !== null) {
          targetPlayerIds.add(selectedDetailPlayerId);
        }
        if (targetPlayerIds.size === 0) return null;

        const simPlayers = rows
          .filter((r) => !draftedIds.has(r.playerId) && r.adpMean !== null)
          .map((r) => ({ playerId: r.playerId, adpMean: r.adpMean, adpStd: r.adpStd }));
        const simPlayerIds = new Set(simPlayers.map((player) => player.playerId));
        const validTargetPlayerIds = [...targetPlayerIds].filter((playerId) =>
          simPlayerIds.has(playerId),
        );
        if (validTargetPlayerIds.length === 0) return null;

        return {
          players: simPlayers,
          currentPickNumber: currentPickN,
          userNextPickNumber: nextPickN,
          targetPlayerIds: validTargetPlayerIds,
          trials: 1000,
        };
      });

      const mcReqKey = (req: McSimRequest | null): string =>
        req === null
          ? "null"
          : `${req.currentPickNumber}:${req.userNextPickNumber}:${[...req.targetPlayerIds].sort().join(",")}`;

      const mcConfidenceByPlayer = toSignal(
        toObservable(mcTriggerSignal).pipe(
          distinctUntilChanged((a, b) => mcReqKey(a) === mcReqKey(b)),
          debounceTime(150),
          switchMap((req) => (req ? mcService.runSimulation(req) : of({ confidence: [] }))),
          map((result) => {
            const m = new Map<string, number>();
            for (const { playerId, survivalRate } of result.confidence) {
              m.set(playerId, survivalRate);
            }
            return m;
          }),
          catchError(() => of(new Map<string, number>())),
        ),
        { initialValue: new Map<string, number>() },
      );

      return {
        baseValueByPlayer,
        pAvailAtNextByPlayer,
        tierCliffByPlayer,
        needMultiplierByPlayer,
        runHeatByPlayer,
        effScoreByPlayer,
        schemeFitByPlayer,
        rookieScoreByPlayer,
        contextModByPlayer,
        vnpByPlayer,
        weightedCompositeByPlayer,
        wcsExplanationByPlayer,
        mcConfidenceByPlayer,
        playerStatsMap,
        pfrStatsMap,
        ngsStatsMap,
        ffOppMap,
        nflverseGsisIdByName,
        /**
         * Player rows with WCS-pipeline fields back-filled. Drives the
         * weighted-composite sort and any UI surface that needs the new signals.
         */
        enrichedRows: computed((): DraftPlayerRow[] => {
          const baseMap = baseValueByPlayer();
          const cliffMap = tierCliffByPlayer();
          const pAvailMap = pAvailAtNextByPlayer();
          const wcsMap = weightedCompositeByPlayer();
          const schemeMap = schemeFitByPlayer();
          const rookieMap = rookieScoreByPlayer();
          const cfbdMap = cfbdMetricsByName();
          return store.rows().map((row) => {
            const base = baseMap.get(row.playerId);
            const cfbd = cfbdMap.get(normalizeCfbdName(row.fullName)) ?? null;
            return {
              ...row,
              baseValue: base?.baseValue ?? null,
              baseValueDivergence: base?.divergence ?? null,
              pAvailAtNext: pAvailMap.get(row.playerId) ?? null,
              tierCliffScore: cliffMap.get(row.playerId)?.cliff ?? null,
              weightedCompositeScore: wcsMap.get(row.playerId) ?? null,
              rookieScore: rookieMap.get(row.playerId) ?? null,
              schemeFit: schemeMap.get(row.playerId) ?? null,
              dominatorRating: cfbd?.dominatorRating ?? null,
              breakoutAge: cfbd?.breakoutAge ?? null,
              ras: cfbd?.ras ?? null,
              landingVacatedTargetPct: null,
            };
          });
        }),
      };
    },
  ),

  // Second withComputed block — can access userRosterId and userNextPickNumber from the first block.
  withComputed((store, appStore = inject(AppStore)) => ({
    /**
     * Positional need entries derived from League roster_positions config (REQ-PN-01 to REQ-PN-08).
     */
    positionalNeeds: computed((): PositionalNeedEntry[] => {
      const league = appStore.selectedLeague();
      const rosterPositions = league?.roster_positions ?? [];
      const { configuredByPos, filledByPos } = buildRosterFillInfo(
        rosterPositions,
        store.picks(),
        store.userRosterId(),
        store.rows(),
        store.existingRosterPlayerIds(),
      );

      const positionOrder = ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "K", "DEF"];

      const configuredQb = configuredByPos["QB"] ?? 0;
      const configuredRb = configuredByPos["RB"] ?? 0;
      const configuredWr = configuredByPos["WR"] ?? 0;
      const configuredTe = configuredByPos["TE"] ?? 0;
      const configuredFlex = configuredByPos["FLEX"] ?? 0;
      const configuredSuperFlex = configuredByPos["SUPER_FLEX"] ?? 0;

      const surplusQb = Math.max(0, (filledByPos["QB"] ?? 0) - configuredQb);
      const surplusRb = Math.max(0, (filledByPos["RB"] ?? 0) - configuredRb);
      const surplusWr = Math.max(0, (filledByPos["WR"] ?? 0) - configuredWr);
      const surplusTe = Math.max(0, (filledByPos["TE"] ?? 0) - configuredTe);

      const flexEligibleSurplus = surplusRb + surplusWr + surplusTe;
      const flexFilled = Math.min(configuredFlex, flexEligibleSurplus);
      const remainingFlexEligibleSurplus = Math.max(0, flexEligibleSurplus - flexFilled);
      const superFlexEligibleSurplus = surplusQb + remainingFlexEligibleSurplus;
      const superFlexFilled = Math.min(configuredSuperFlex, superFlexEligibleSurplus);

      const effectiveFilledByPos: Record<string, number> = {
        ...filledByPos,
        FLEX: flexFilled,
        SUPER_FLEX: superFlexFilled,
      };

      return positionOrder
        .filter((pos) => (configuredByPos[pos] ?? 0) > 0)
        .map((pos) => {
          const configured = configuredByPos[pos] ?? 0;
          const filled = Math.min(effectiveFilledByPos[pos] ?? 0, configured);
          return { position: pos, configured, filled, remaining: configured - filled };
        });
    }),

    /**
     * All player rows (including drafted) sorted by the active sortSource.
     * Filtered by searchQuery and neededPositionsOnly when active.
     * Drafted players carry isDrafted=true and availability risk info for display.
     * REQ-PL-01, REQ-PL-02, REQ-PL-05, REQ-PL-06, REQ-SN-01 to REQ-SN-07, REQ-PL-11.
     */
    allPlayerRows: computed((): DraftPlayerDisplayRow[] => {
      const sortSrc = store.sortSource();
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store
          .picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );
      const query = store.searchQuery().toLowerCase().trim();
      const neededOnly = store.neededPositionsOnly();

      // Compute needed positions when filter is active
      const neededPositions = new Set<string>();
      if (neededOnly) {
        const league = appStore.selectedLeague();
        const rosterPositions = league?.roster_positions ?? [];
        const { configuredByPos, filledByPos } = buildRosterFillInfo(
          rosterPositions,
          store.picks(),
          store.userRosterId(),
          store.rows(),
          store.existingRosterPlayerIds(),
        );
        const flexEligiblePositions: DraftPositionFilter[] = ["RB", "WR", "TE"];
        const superFlexEligiblePositions: DraftPositionFilter[] = ["QB", "RB", "WR", "TE"];

        for (const pos of ["QB", "RB", "WR", "TE"] as const) {
          const configured = configuredByPos[pos] ?? 0;
          const flex = flexEligiblePositions.includes(pos) ? (configuredByPos["FLEX"] ?? 0) : 0;
          const superFlex = superFlexEligiblePositions.includes(pos)
            ? (configuredByPos["SUPER_FLEX"] ?? 0)
            : 0;
          const total = configured + flex + superFlex;
          const filled = filledByPos[pos] ?? 0;
          if (filled < total) neededPositions.add(pos);
        }
      }

      // Compute pick position for availability risk (REQ-PA-05)
      // Only compute at-risk thresholds when userNextPickNumber is known; otherwise
      // treat all undrafted players as safe to avoid false "At Risk" labels.
      const currentPickNumber = store.picks().length + 1;
      const userNextPick = store.userNextPickNumber();
      const atRiskThreshold = userNextPick !== null ? userNextPick : null;
      const goingSoonThreshold = currentPickNumber + 2; // within next 3 picks

      return [...store.enrichedRows()]
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !neededOnly || neededPositions.has(row.position))
        .filter((row) => !query || row.fullName.toLowerCase().includes(query))
        .sort((a, b) => sortBySortSource(a, b, sortSrc))
        .map((row) => {
          const isDrafted = picked.has(row.playerId);
          const adpRef = row.averageRank;
          let availabilityRisk: "safe" | "at-risk" | "gone" = "safe";
          let isGoingSoon = false;
          if (isDrafted) {
            availabilityRisk = "gone";
          } else if (atRiskThreshold !== null && adpRef !== null && adpRef <= atRiskThreshold) {
            availabilityRisk = "at-risk";
          }
          if (!isDrafted && adpRef !== null && adpRef <= goingSoonThreshold) {
            isGoingSoon = true;
          }
          return { ...row, isDrafted, availabilityRisk, isGoingSoon };
        });
    }),

    availableRows: computed(() => {
      const tierSrc = store.tierSource();
      const valueSrc = store.valueSource();
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store
          .picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      return store
        .enrichedRows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .sort((a, b) => {
          const aTier = resolveDraftTier(a, tierSrc);
          const bTier = resolveDraftTier(b, tierSrc);
          if (aTier !== bTier) return aTier - bTier;

          const aRank =
            valueSrc === "ktcValue"
              ? (a.ktcRank ?? Number.MAX_SAFE_INTEGER)
              : (a.averageRank ?? a.ktcRank ?? Number.MAX_SAFE_INTEGER);
          const bRank =
            valueSrc === "ktcValue"
              ? (b.ktcRank ?? Number.MAX_SAFE_INTEGER)
              : (b.averageRank ?? b.ktcRank ?? Number.MAX_SAFE_INTEGER);
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });
    }),

    recommendations: computed(() => {
      const tierSrc = store.tierSource();
      const valueSrc = store.valueSource();
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store
          .picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      const positionOrder: Record<DraftPositionFilter, number> = {
        QB: 0,
        RB: 1,
        WR: 2,
        TE: 3,
      };

      const currentPickNumber = store.picks().length + 1;
      const userNextPick = store.userNextPickNumber();
      const picksUntilMyTurn = userNextPick !== null ? userNextPick - currentPickNumber : 0;
      const atRiskThreshold = currentPickNumber + picksUntilMyTurn;

      const sortedRows = store
        .enrichedRows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .sort((a, b) => {
          const aTier = resolveDraftTier(a, tierSrc);
          const bTier = resolveDraftTier(b, tierSrc);
          if (aTier !== bTier) return aTier - bTier;

          const aPosition = positionOrder[a.position];
          const bPosition = positionOrder[b.position];
          if (aPosition !== bPosition) return aPosition - bPosition;

          return resolveDraftValue(b, valueSrc) - resolveDraftValue(a, valueSrc);
        });

      // Find top 3 distinct tier values
      const tierOrder: number[] = [];
      const seenTiers = new Set<number>();
      for (const row of sortedRows) {
        const tier = resolveDraftTier(row, tierSrc);
        if (!seenTiers.has(tier)) {
          tierOrder.push(tier);
          seenTiers.add(tier);
        }
      }
      const top3Tiers = new Set(tierOrder.slice(0, 3));

      // Filter to top 3 tiers and cap at 3 players per tier
      const tierPlayerCounts = new Map<number, number>();
      const filtered = sortedRows.filter((row) => {
        const tier = resolveDraftTier(row, tierSrc);
        if (!top3Tiers.has(tier)) return false;
        const count = tierPlayerCounts.get(tier) ?? 0;
        if (count >= 3) return false;
        tierPlayerCounts.set(tier, count + 1);
        return true;
      });

      return filtered.map<DraftRecommendation>((row) => {
        const adpRef = row.averageRank;
        const availabilityRisk: "safe" | "at-risk" | "gone" =
          adpRef !== null && adpRef <= atRiskThreshold ? "at-risk" : "safe";
        return {
          playerId: row.playerId,
          fullName: row.fullName,
          position: row.position,
          team: row.team,
          ktcValue: row.ktcValue,
          ktcRank: row.ktcRank,
          overallTier: row.overallTier,
          positionalTier: row.positionalTier,
          flockAverageTier: row.flockAverageTier,
          flockAveragePositionalTier: row.flockAveragePositionalTier,
          averageRank: row.averageRank,
          combinedTier: row.combinedTier,
          adpDelta: row.adpDelta,
          availabilityRisk,
          boostedScore: resolveDraftValue(row, valueSrc),
        };
      });
    }),

    starredRows: computed(() => {
      const stars = new Set(store.starredPlayerIds());
      const selected = new Set(store.selectedPositions());
      const picked = new Set(
        store
          .picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      return store
        .enrichedRows()
        .filter((row) => selected.has(row.position))
        .filter((row) => !store.rookiesOnly() || row.rookie)
        .filter((row) => !picked.has(row.playerId))
        .filter((row) => stars.has(row.playerId))
        .sort((a, b) => {
          const aRank = a.ktcRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.ktcRank ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return a.sleeperRank - b.sleeperRank;
        });
    }),

    /**
     * My roster picks — picks belonging to the current user's team (REQ-SM-04).
     */
    myRosterPicks: computed(() => {
      const rosterId = store.userRosterId();
      if (rosterId === null) return [];

      return store
        .picks()
        .filter((pick) => pick.roster_id === rosterId && !!pick.player_id)
        .sort((a, b) => a.pick_no - b.pick_no);
    }),

    /**
     * My roster player rows — enriched rows for the user's drafted players (REQ-SM-04 to REQ-SM-06).
     */
    myRosterRows: computed((): DraftPlayerRow[] => {
      const rosterId = store.userRosterId();
      if (rosterId === null) return [];

      const myPickIds = new Set(
        store
          .picks()
          .filter((pick) => pick.roster_id === rosterId && !!pick.player_id)
          .map((pick) => pick.player_id),
      );

      return store.enrichedRows().filter((row) => myPickIds.has(row.playerId));
    }),

    pickBoard: computed(() => [...store.picks()].sort((a, b) => a.pick_no - b.pick_no)),
    recentPicks: computed(() =>
      [...store.picks()].sort((a, b) => b.pick_no - a.pick_no).slice(0, 10),
    ),
    nextPickNumber: computed(() => store.picks().length + 1),

    /**
     * Best available player per position group (QB, RB, WR, TE).
     * Ordered by positional need priority (REQ-BA-07).
     * Includes lowestAvailableTier and availabilityRisk (REQ-BA-05, REQ-BA-06, REQ-BA-07).
     * Satisfies REQ-BA-02, REQ-BA-03, REQ-BA-04, REQ-BA-08.
     */
    bestAvailableByPosition: computed((): BestAvailableEntry[] => {
      const picked = new Set(
        store
          .picks()
          .filter((pick) => !!pick.player_id)
          .map((pick) => pick.player_id),
      );
      const selected = store.selectedPositions();
      const positionsToShow: DraftPositionFilter[] =
        selected.length === DEFAULT_POSITIONS.length
          ? BEST_AVAILABLE_POSITIONS
          : selected.filter((p): p is DraftPositionFilter =>
              BEST_AVAILABLE_POSITIONS.includes(p as DraftPositionFilter),
            );

      const positionsToShowSet = new Set<string>(positionsToShow);
      const bestByPos = new Map<DraftPositionFilter, DraftPlayerRow>();
      const lowestTierByPos = new Map<DraftPositionFilter, number>();
      const rookiesOnly = store.rookiesOnly();

      // Compute availability risk threshold using shared userNextPickNumber (REQ-PA-05)
      // Only mark at-risk when next pick number is known to avoid false positives.
      const userNextPick = store.userNextPickNumber();
      const atRiskThreshold: number | null = userNextPick;

      const isBetterCandidate = (candidate: DraftPlayerRow, current: DraftPlayerRow): boolean => {
        const candidateTier = candidate.combinedTier ?? Number.MAX_SAFE_INTEGER;
        const currentTier = current.combinedTier ?? Number.MAX_SAFE_INTEGER;
        if (candidateTier !== currentTier) {
          return candidateTier < currentTier;
        }
        return candidate.sleeperRank < current.sleeperRank;
      };

      for (const row of store.enrichedRows()) {
        if (
          picked.has(row.playerId) ||
          !positionsToShowSet.has(row.position) ||
          (rookiesOnly && !row.rookie)
        ) {
          continue;
        }

        const pos = row.position as DraftPositionFilter;
        const currentBest = bestByPos.get(pos);
        if (!currentBest || isBetterCandidate(row, currentBest)) {
          bestByPos.set(pos, row);
        }

        const rowTier = row.combinedPositionalTier ?? row.combinedTier;
        if (rowTier !== null) {
          const currentLowest = lowestTierByPos.get(pos);
          if (currentLowest === undefined || rowTier < currentLowest) {
            lowestTierByPos.set(pos, rowTier);
          }
        }
      }

      // Compute need-based ordering for positions (REQ-BA-07)
      const league = appStore.selectedLeague();
      const rosterPositions = league?.roster_positions ?? [];
      const { configuredByPos, filledByPos } = buildRosterFillInfo(
        rosterPositions,
        store.picks(),
        store.userRosterId(),
        store.rows(),
        store.existingRosterPlayerIds(),
      );

      // Use FLEX-aware remaining calculation for need priority (RB/WR/TE eligible for FLEX,
      // QB/RB/WR/TE eligible for SUPER_FLEX).
      const flexEligiblePositions = new Set(["RB", "WR", "TE"]);
      const superFlexEligiblePositions = new Set(["QB", "RB", "WR", "TE"]);
      const remainingByPos = (pos: string): number => {
        const configured = configuredByPos[pos] ?? 0;
        const flex = flexEligiblePositions.has(pos) ? (configuredByPos["FLEX"] ?? 0) : 0;
        const superFlex = superFlexEligiblePositions.has(pos)
          ? (configuredByPos["SUPER_FLEX"] ?? 0)
          : 0;
        const filled = filledByPos[pos] ?? 0;
        return Math.max(0, configured + flex + superFlex - filled);
      };

      const orderedPositions = [...positionsToShow].sort(
        (a, b) => remainingByPos(b) - remainingByPos(a),
      );

      return orderedPositions.map((pos) => {
        const player = bestByPos.get(pos) ?? null;
        const adpRef = player?.averageRank ?? null;
        const availabilityRisk: "safe" | "at-risk" | "gone" =
          atRiskThreshold !== null && adpRef !== null && adpRef <= atRiskThreshold
            ? "at-risk"
            : "safe";
        return {
          position: pos,
          player,
          lowestAvailableTier: lowestTierByPos.get(pos) ?? null,
          availabilityRisk,
        };
      });
    }),
  })),
  withMethods(
    (
      store,
      appStore = inject(AppStore),
      sleeper = inject(SleeperService),
      storage = inject(StorageService),
      playerNorm = inject(PlayerNormalizationService),
    ) => {
      let pollHandle: ReturnType<typeof setInterval> | null = null;
      let refreshInFlight = false;

      const selectedDraftStorageKey = (leagueId: string): string =>
        `draftAssistant.selectedDraft.${leagueId}`;
      const starStorageKey = (leagueId: string): string => `draftAssistant.draftStars.${leagueId}`;
      const sortSourceStorageKey = (leagueId: string): string =>
        `draftAssistant.sortSource.${leagueId}`;
      const positionsStorageKey = (leagueId: string): string =>
        `draftAssistant.positions.${leagueId}`;
      const stopPolling = (): void => {
        if (pollHandle !== null) {
          clearInterval(pollHandle);
          pollHandle = null;
        }
      };

      const getPollingInterval = (status: string | null): number | null => {
        if (!status) {
          return null;
        }

        const normalizedStatus = status.toLowerCase().trim();
        if (normalizedStatus === "drafting") {
          return 1000;
        }
        if (
          normalizedStatus === "pre_draft" ||
          normalizedStatus === "scheduled" ||
          normalizedStatus === "paused"
        ) {
          return 5000;
        }

        return null;
      };

      const maybeStartPolling = (): void => {
        const selectedDraftId = store.selectedDraftId();
        const status = store.draftStatus();
        const interval = getPollingInterval(status);

        if (!selectedDraftId || interval === null) {
          stopPolling();
          return;
        }

        if (pollHandle !== null) {
          return;
        }

        pollHandle = setInterval(() => {
          void refreshDraft();
        }, interval);
      };

      const mapRosterDisplayNames = (
        rosters: LeagueRoster[],
        users: LeagueUser[],
      ): Record<string, string> => {
        const usersById = toMapById(users, "user_id");

        return rosters.reduce<Record<string, string>>((acc, roster) => {
          const ownerId = roster.owner_id ?? "";
          const user = ownerId ? usersById[ownerId] : undefined;
          acc[String(roster.roster_id)] = user?.display_name ?? `Roster ${roster.roster_id}`;
          return acc;
        }, {});
      };

      const normalizePicks = (
        draft: SleeperDraft,
        picks: SleeperDraftPick[],
      ): SleeperDraftPick[] => {
        const slotMap = draft.slot_to_roster_id ?? {};

        return picks
          .filter((pick) => !!pick.player_id)
          .map((pick) => {
            const slot = pick.draft_slot ?? null;
            const mappedRosterId = slot !== null ? slotMap[String(slot)] : undefined;
            const rosterId = pick.roster_id ?? mappedRosterId ?? null;
            return {
              ...pick,
              roster_id: rosterId,
            };
          })
          .sort((a, b) => a.pick_no - b.pick_no);
      };

      const chooseDraftId = (leagueId: string, drafts: SleeperDraft[]): string | null => {
        const savedDraftId = storage.getRawItem(selectedDraftStorageKey(leagueId));

        if (savedDraftId && drafts.some((draft) => draft.draft_id === savedDraftId)) {
          return savedDraftId;
        }

        const drafting = drafts.find((draft) => draft.status === "drafting");
        if (drafting) {
          return drafting.draft_id;
        }

        const sorted = [...drafts].sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));
        return sorted[0]?.draft_id ?? null;
      };

      const upsertDraft = (drafts: SleeperDraft[], draft: SleeperDraft): SleeperDraft[] => {
        const hasDraft = drafts.some((existing) => existing.draft_id === draft.draft_id);
        if (!hasDraft) {
          return [draft, ...drafts];
        }

        return drafts.map((existing) => (existing.draft_id === draft.draft_id ? draft : existing));
      };

      const loadStarredPlayerIds = (leagueId: string | null): string[] => {
        if (!leagueId) {
          return [];
        }

        const parsed = storage.getItem<string[]>(starStorageKey(leagueId));
        return Array.isArray(parsed) ? parsed : [];
      };

      const loadSortSource = (leagueId: string | null): DraftSortSource => {
        if (!leagueId) return "combinedTier";
        const saved = storage.getRawItem(sortSourceStorageKey(leagueId));
        const valid: DraftSortSource[] = [
          "combinedTier",
          "sleeperRank",
          "ktcRank",
          "flockRank",
          "combinedPositionalTier",
          "adpDelta",
          "valueGap",
          "fpAdpRank",
          "weightedComposite",
        ];
        return valid.includes(saved as DraftSortSource)
          ? (saved as DraftSortSource)
          : "combinedTier";
      };

      const loadSavedPositions = (leagueId: string | null): DraftPositionFilter[] => {
        if (!leagueId) return DEFAULT_POSITIONS;
        const parsed = storage.getItem<DraftPositionFilter[]>(positionsStorageKey(leagueId));
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_POSITIONS;
        const valid = new Set<string>(DEFAULT_POSITIONS);
        const filtered = parsed.filter((p) => valid.has(p));
        return filtered.length > 0 ? filtered : DEFAULT_POSITIONS;
      };

      const loadDraftContext = async (
        draft: SleeperDraft,
        fallbackLeagueId: string | null,
      ): Promise<{
        selectedLeagueId: string | null;
        rosterDisplayNames: Record<string, string>;
        rosterAvatarIds: Record<string, string | null>;
        playerNameMap: Record<string, string>;
        rows: DraftPlayerRow[];
        starredPlayerIds: string[];
      }> => {
        const selectedLeague = appStore.selectedLeague();
        const selectedLeagueId = draft.league_id || fallbackLeagueId;
        const season = draft.season ?? selectedLeague?.season ?? String(new Date().getFullYear());
        const isSuperflex =
          selectedLeague?.league_id === selectedLeagueId
            ? (selectedLeague.roster_positions ?? []).includes("SUPER_FLEX")
            : false;

        const isRookieDraft = isSleeperRookieDraft(draft);

        const [playersById, rows] = await Promise.all([
          firstValueFrom(sleeper.getAllPlayers()),
          playerNorm.buildPlayerRows({
            format: { isSuperflex, isRookie: isRookieDraft },
            season: Number(season),
          }),
        ]);

        const playerNameMap = Object.entries(playersById).reduce<Record<string, string>>(
          (acc, [id, player]) => {
            const firstName = player.first_name ?? "";
            const lastName = player.last_name ?? "";
            const fullName = player.full_name?.trim() || `${firstName} ${lastName}`.trim();
            if (fullName.length > 0) {
              acc[id] = fullName;
            }
            return acc;
          },
          {},
        );

        let rosterDisplayNames: Record<string, string> = {};
        let rosterAvatarIds: Record<string, string | null> = {};
        if (selectedLeagueId) {
          try {
            const [rosters, users] = await firstValueFrom(
              forkJoin([
                sleeper.getLeagueRosters(selectedLeagueId),
                sleeper.getLeagueUsers(selectedLeagueId),
              ]),
            );
            rosterDisplayNames = mapRosterDisplayNames(rosters, users);
            rosterAvatarIds = mapRosterAvatarIds(rosters, users);
          } catch {
            rosterDisplayNames = {};
            rosterAvatarIds = {};
          }
        }

        return {
          selectedLeagueId,
          rosterDisplayNames,
          rosterAvatarIds,
          playerNameMap,
          rows,
          starredPlayerIds: loadStarredPlayerIds(selectedLeagueId),
        };
      };

      /**
       * Detect tier drops after new picks are received (REQ-TD-01 to REQ-TD-07).
       * Returns alerts for each positional tier that lost its last undrafted player.
       * Deduplicates by (position, droppedTier) to handle multiple picks in one poll.
       */
      const detectTierDrops = (
        newPickedIds: Set<string>,
        prevPickedIds: Set<string>,
        rows: DraftPlayerRow[],
      ): TierDropAlert[] => {
        const newlyPickedIds = [...newPickedIds].filter((id) => !prevPickedIds.has(id));
        if (newlyPickedIds.length === 0) return [];

        // Group remaining undrafted rows by position+positionalTier
        const undraftedByPosTier = new Map<string, DraftPlayerRow[]>();
        for (const row of rows) {
          if (newPickedIds.has(row.playerId)) continue;
          const tier = row.combinedPositionalTier;
          if (tier === null) continue;
          const key = `${row.position}:${tier}`;
          const existing = undraftedByPosTier.get(key) ?? [];
          existing.push(row);
          undraftedByPosTier.set(key, existing);
        }

        // Deduplicate: only one alert per (position, droppedTier) per refresh
        const seen = new Set<string>();
        const alerts: TierDropAlert[] = [];

        for (const newlyPickedId of newlyPickedIds) {
          const draftedRow = rows.find((r) => r.playerId === newlyPickedId);
          if (!draftedRow) continue;
          const tier = draftedRow.combinedPositionalTier;
          if (tier === null) continue;
          const key = `${draftedRow.position}:${tier}`;
          if (seen.has(key)) continue;

          const remaining = undraftedByPosTier.get(key) ?? [];

          // If no undrafted players remain in this positional tier → tier drop
          if (remaining.length === 0) {
            seen.add(key);
            // Find the next available tier for this position
            const undraftedSamePosRows = rows
              .filter(
                (r) =>
                  r.position === draftedRow.position &&
                  !newPickedIds.has(r.playerId) &&
                  r.combinedPositionalTier !== null,
              )
              .sort((a, b) => (a.combinedPositionalTier ?? 99) - (b.combinedPositionalTier ?? 99));
            const nextTier = undraftedSamePosRows[0]?.combinedPositionalTier ?? null;

            alerts.push({
              id: generateAlertId(draftedRow.position, tier),
              position: draftedRow.position as DraftPositionFilter,
              droppedTier: tier,
              nextTier,
              createdAt: Date.now(),
            });
          }
        }

        return alerts;
      };

      const refreshDraft = async (): Promise<void> => {
        if (refreshInFlight) {
          return;
        }

        const selectedDraftId = store.selectedDraftId();
        if (!selectedDraftId) {
          return;
        }

        refreshInFlight = true;
        try {
          const prevPickedIds = new Set(
            store
              .picks()
              .filter((pick) => !!pick.player_id)
              .map((pick) => pick.player_id),
          );

          const [draft, picks, tradedPicks] = await firstValueFrom(
            forkJoin([
              sleeper.getDraft(selectedDraftId),
              sleeper.getDraftPicks(selectedDraftId),
              sleeper.getTradedDraftPicks(selectedDraftId).pipe(catchError(() => of([]))),
            ]),
          );

          const normalizedPicks = normalizePicks(draft, picks);
          const newPickedIds = new Set(
            normalizedPicks.map((p) => p.player_id).filter((id): id is string => !!id),
          );
          const newAlerts = detectTierDrops(newPickedIds, prevPickedIds, store.rows());

          patchState(store, {
            draftStatus: draft.status ?? null,
            drafts: upsertDraft(store.drafts(), draft),
            picks: normalizedPicks,
            tradedPicks,
            staleData: false,
            lastUpdatedAt: Date.now(),
            error: null,
            tierDropAlerts: [...store.tierDropAlerts(), ...newAlerts],
          });
        } catch {
          patchState(store, {
            staleData: true,
            error: "Failed to refresh draft state. Retrying automatically.",
          });
        } finally {
          refreshInFlight = false;
          maybeStartPolling();
        }
      };

      const loadForLeague = async (leagueId: string, season: string): Promise<void> => {
        patchState(store, {
          loading: true,
          error: null,
          staleData: false,
          selectedLeagueId: leagueId,
          picks: [],
          tradedPicks: [],
        });

        try {
          const isSuperflex = (appStore.selectedLeague()?.roster_positions ?? []).includes(
            "SUPER_FLEX",
          );
          // We don't yet know whether this league's primary draft is a rookie draft;
          // optimistically fetch the redraft variants and re-fetch only if needed once
          // the resolved draft turns out to be a rookie one.
          const [rosters, users, drafts, initialRows] = await Promise.all([
            firstValueFrom(sleeper.getLeagueRosters(leagueId)),
            firstValueFrom(sleeper.getLeagueUsers(leagueId)),
            firstValueFrom(sleeper.getLeagueDrafts(leagueId)),
            playerNorm.buildPlayerRows({
              format: { isSuperflex, isRookie: false },
              season: Number(season),
            }),
          ]);

          const rosterDisplayNames = mapRosterDisplayNames(rosters, users);
          const rosterAvatarIds = mapRosterAvatarIds(rosters, users);
          const userId = appStore.user()?.user_id ?? null;
          const userRoster = userId ? (rosters.find((r) => r.owner_id === userId) ?? null) : null;
          const existingRosterPlayerIds = userRoster?.players ?? [];
          const selectedDraftId = chooseDraftId(leagueId, drafts);

          let selectedDraft: SleeperDraft | null = null;
          let picks: SleeperDraftPick[] = [];
          let tradedPicks: SleeperTradedPick[] = [];
          let nextDrafts = drafts;
          if (selectedDraftId) {
            const [draftDetail, draftPicks, draftTradedPicks] = await firstValueFrom(
              forkJoin([
                sleeper.getDraft(selectedDraftId),
                sleeper.getDraftPicks(selectedDraftId),
                sleeper.getTradedDraftPicks(selectedDraftId).pipe(catchError(() => of([]))),
              ]),
            );
            selectedDraft = draftDetail;
            nextDrafts = upsertDraft(drafts, draftDetail);
            picks = normalizePicks(draftDetail, draftPicks);
            tradedPicks = draftTradedPicks;
          }

          const isRookieDraft = selectedDraft ? isSleeperRookieDraft(selectedDraft) : false;
          // Re-fetch rows with rookie-format ranking sources if the resolved draft is rookie.
          const rows = isRookieDraft
            ? await playerNorm.buildPlayerRows({
                format: { isSuperflex, isRookie: true },
                season: Number(season),
              })
            : initialRows;

          const starredPlayerIds = (() => {
            const parsed = storage.getItem<string[]>(starStorageKey(leagueId));
            return Array.isArray(parsed) ? parsed : [];
          })();

          patchState(store, {
            loading: false,
            selectedLeagueId: leagueId,
            draftSource: selectedDraftId ? "league" : store.draftSource(),
            drafts: nextDrafts,
            selectedDraftId,
            draftStatus: selectedDraft?.status ?? null,
            rosterDisplayNames,
            rosterAvatarIds,
            rows,
            picks,
            tradedPicks,
            rookiesOnly: isRookieDraft,
            starredPlayerIds,
            sortSource: loadSortSource(leagueId),
            selectedPositions: loadSavedPositions(leagueId),
            lastUpdatedAt: Date.now(),
            existingRosterPlayerIds,
          });

          if (selectedDraftId) {
            storage.setRawItem(selectedDraftStorageKey(leagueId), selectedDraftId);
          }
        } catch (error: unknown) {
          patchState(store, {
            loading: false,
            error: toErrorMessage(error, "Failed to load draft data."),
          });
        } finally {
          maybeStartPolling();
        }
      };

      const resetForNoLeague = (): void => {
        stopPolling();
        patchState(store, {
          loading: false,
          error: null,
          staleData: false,
          selectedLeagueId: null,
          draftSource: null,
          drafts: [],
          selectedDraftId: null,
          draftStatus: null,
          rosterDisplayNames: {},
          rosterAvatarIds: {},
          picks: [],
          tradedPicks: [],
          rows: [],
          starredPlayerIds: [],
          lastUpdatedAt: null,
          existingRosterPlayerIds: [],
        });
      };

      return {
        async loadForSelectedLeague(): Promise<void> {
          const selectedLeague = appStore.selectedLeague();
          if (!selectedLeague) {
            resetForNoLeague();
            return;
          }

          await loadForLeague(selectedLeague.league_id, selectedLeague.season);
        },
        async selectDraft(draftId: string, options?: SelectDraftOptions): Promise<void> {
          const fallbackLeagueId =
            store.selectedLeagueId() ?? appStore.selectedLeague()?.league_id ?? null;

          patchState(store, {
            selectedDraftId: draftId,
            loading: true,
            error: null,
          });

          try {
            const [draft, picks, tradedPicks] = await firstValueFrom(
              forkJoin([
                sleeper.getDraft(draftId),
                sleeper.getDraftPicks(draftId),
                sleeper.getTradedDraftPicks(draftId).pipe(catchError(() => of([]))),
              ]),
            );
            const context = await loadDraftContext(draft, fallbackLeagueId);

            const nextDrafts = upsertDraft(store.drafts(), draft);

            patchState(store, {
              loading: false,
              selectedLeagueId: context.selectedLeagueId,
              draftSource: options?.source ?? store.draftSource() ?? "league",
              rosterDisplayNames: context.rosterDisplayNames,
              rosterAvatarIds: context.rosterAvatarIds,
              playerNameMap: context.playerNameMap,
              rows: context.rows,
              drafts: nextDrafts,
              draftStatus: draft.status ?? null,
              picks: normalizePicks(draft, picks),
              tradedPicks,
              rookiesOnly: options?.rookieHint === true ? true : isSleeperRookieDraft(draft),
              starredPlayerIds: context.starredPlayerIds,
              staleData: false,
              lastUpdatedAt: Date.now(),
            });

            if (context.selectedLeagueId) {
              storage.setRawItem(selectedDraftStorageKey(context.selectedLeagueId), draftId);
            }
          } catch (error: unknown) {
            patchState(store, {
              loading: false,
              error: toErrorMessage(error, "Failed to load draft details."),
            });
          } finally {
            maybeStartPolling();
          }
        },
        async refreshNow(): Promise<void> {
          await refreshDraft();
        },
        retry(): void {
          if (store.selectedDraftId()) {
            void refreshDraft();
            return;
          }

          void this.loadForSelectedLeague();
        },
        setDraftSource(source: DraftSourceMode): void {
          patchState(store, {
            draftSource: source,
            error: null,
          });
        },
        setDraftMode(draftMode: DraftMode): void {
          patchState(store, { draftMode });
          storage.setRawItem(DRAFT_MODE_STORAGE_KEY, draftMode);
        },
        setTierSource(tierSource: TierSource): void {
          patchState(store, { tierSource });
        },
        setValueSource(valueSource: DraftValueSource): void {
          patchState(store, { valueSource });
        },
        togglePosition(position: DraftPositionFilter): void {
          const next = togglePositionFilter(store.selectedPositions(), position);
          patchState(store, { selectedPositions: next });
          const leagueId = store.selectedLeagueId();
          if (leagueId) storage.setItem(positionsStorageKey(leagueId), next);
        },
        setRookiesOnly(value: boolean): void {
          patchState(store, { rookiesOnly: value });
        },
        setSortSource(sortSource: DraftSortSource): void {
          patchState(store, { sortSource });
          const leagueId = store.selectedLeagueId();
          if (leagueId) storage.setRawItem(sortSourceStorageKey(leagueId), sortSource);
        },
        toggleStar(playerId: string): void {
          const current = store.starredPlayerIds();
          const next = current.includes(playerId)
            ? current.filter((id) => id !== playerId)
            : [...current, playerId];

          patchState(store, { starredPlayerIds: next });

          const leagueId = store.selectedLeagueId();
          if (!leagueId) {
            return;
          }

          storage.setItem(starStorageKey(leagueId), next);
        },
        /**
         * Clears all session-specific storage keys and resets the draft state.
         * Returns the app to the draft-source selection screen (REQ-SM-08).
         */
        resetSession(): void {
          stopPolling();
          const leagueId = store.selectedLeagueId();
          if (leagueId) {
            storage.removeItem(selectedDraftStorageKey(leagueId));
            storage.removeItem(starStorageKey(leagueId));
            storage.removeItem(sortSourceStorageKey(leagueId));
            storage.removeItem(positionsStorageKey(leagueId));
          }
          patchState(store, {
            loading: false,
            error: null,
            staleData: false,
            selectedDraftId: null,
            draftStatus: null,
            picks: [],
            tradedPicks: [],
            rows: [],
            starredPlayerIds: [],
            sortSource: "combinedTier",
            selectedPositions: DEFAULT_POSITIONS,
            lastUpdatedAt: null,
            searchQuery: "",
            neededPositionsOnly: false,
            tierDropAlerts: [],
          });
        },
        stopPolling(): void {
          stopPolling();
        },
        /** Update search query (REQ-SN-01 to REQ-SN-07). */
        setSearchQuery(query: string): void {
          patchState(store, { searchQuery: query });
        },
        /** Toggle "needed positions only" filter (REQ-PL-11). */
        toggleNeededPositionsOnly(): void {
          patchState(store, { neededPositionsOnly: !store.neededPositionsOnly() });
        },
        /** Dismiss a specific tier-drop alert by id (REQ-TD-03). */
        dismissTierAlert(id: string): void {
          patchState(store, {
            tierDropAlerts: store.tierDropAlerts().filter((a) => a.id !== id),
          });
        },
        /** Open the player detail drawer for the given Sleeper player ID; null closes it. */
        selectDetailPlayer(id: string | null): void {
          patchState(store, { selectedDetailPlayerId: id });
        },
      };
    },
  ),
  withHooks((store, appStore = inject(AppStore), storage = inject(StorageService)) => {
    let previousLeagueId: string | null = null;
    const storeWithMethods = store as typeof store & {
      loadForSelectedLeague: () => Promise<void>;
      stopPolling: () => void;
      setDraftMode: (mode: DraftMode) => void;
    };

    return {
      onInit(): void {
        const savedMode = storage.getRawItem(DRAFT_MODE_STORAGE_KEY);
        if (isDraftMode(savedMode)) {
          storeWithMethods.setDraftMode(savedMode);
        }

        effect(() => {
          const leagueId = appStore.selectedLeague()?.league_id ?? null;
          if (leagueId === previousLeagueId) {
            return;
          }

          previousLeagueId = leagueId;
          void storeWithMethods.loadForSelectedLeague();
        });
      },
      onDestroy(): void {
        storeWithMethods.stopPolling();
      },
    };
  }),
);
