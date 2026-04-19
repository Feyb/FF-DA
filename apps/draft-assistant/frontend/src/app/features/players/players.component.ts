import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { toSignal, toObservable } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";
import { TierLegendComponent } from "../../shared/components/tier-legend";
import { LoadingStateComponent } from "../../shared/components/loading-state";
import { ErrorStateComponent } from "../../shared/components/error-state";
import {
  PlayerRow,
  PlayersStore,
  PositionFilter,
  SortBy,
  SortDirection,
  ValueSource,
} from "./players.store";
import { TierSource } from "../../core/models";
import { SleeperPlayerStats } from "../../core/models";
import { resolveTier } from "../../core/utils/tier-resolution.util";
import { getTierColorClass } from "../../shared/pipes/tier-color.pipe";
import { PageHeaderComponent } from "../../shared/components/page-header";
import {
  PlayerDetailGridItem,
  PlayerDetailsGridComponent,
} from "../../shared/components/player-details-grid";
import { SleeperStatsService } from "../../core/adapters/sleeper/sleeper-stats.service";
import { AppStore } from "../../core/state/app.store";
import { PlayerCardComponent } from "../../shared/components/player-card";

interface PlayersStoreView {
  selectedPositions: () => PositionFilter[];
  rookiesOnly: () => boolean;
  searchQuery: () => string;
  sortBy: () => SortBy;
  sortDirection: () => SortDirection;
  tierSource: () => TierSource;
  valueSource: () => ValueSource;
  ktcUnavailable: () => boolean;
  ktcStaleDays: () => number | null;
  ktcSyncedAt: () => string | null;
  loading: () => boolean;
  error: () => string | null;
  displayedRows: () => PlayerRow[];
  setRookiesOnly: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (value: SortBy) => void;
  setSortDirection: (value: SortDirection) => void;
  setTierSource: (value: TierSource) => void;
  setValueSource: (value: ValueSource) => void;
  togglePosition: (position: PositionFilter) => void;
  loadPlayers: () => Promise<void>;
}

@Component({
  selector: "app-players",
  templateUrl: "./players.component.html",
  styleUrl: "./players.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlayersStore],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TierLegendComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    PlayerDetailsGridComponent,
    PlayerCardComponent,
  ],
})
export class PlayersComponent {
  protected readonly store = inject(PlayersStore) as PlayersStoreView;
  private readonly appStore = inject(AppStore);
  private readonly statsService = inject(SleeperStatsService);

  protected readonly tierSources: Array<{ value: TierSource; label: string }> = [
    { value: "average", label: "Average (KTC + Flock)" },
    { value: "flock", label: "Flock" },
    { value: "ktc", label: "KTC" },
  ];
  protected readonly valueSources: Array<{ value: ValueSource; label: string }> = [
    { value: "ktcValue", label: "KTC Value" },
    { value: "averageRank", label: "Flock Average Rank" },
  ];
  protected expandedPlayerId: string | null = null;
  protected readonly positions = ["QB", "RB", "WR", "TE"] as const;

  private readonly seasonYear = computed(() => {
    const season = this.appStore.selectedLeague()?.season;
    return season ? Number(season) : new Date().getUTCFullYear() - 1;
  });

  protected readonly statsMap = toSignal(
    toObservable(this.seasonYear).pipe(switchMap((year) => this.statsService.fetchStats(year))),
    { initialValue: new Map<string, SleeperPlayerStats>() },
  );

  protected playerCardRank(player: PlayerRow): number | null {
    return this.store.valueSource() === "ktcValue" ? player.ktcRank : player.averageRank;
  }

  protected playerCardRankLabel(): string {
    return this.store.valueSource() === "ktcValue" ? "KTC" : "Flock";
  }

  protected togglePosition(position: "QB" | "RB" | "WR" | "TE"): void {
    this.store.togglePosition(position);
  }

  protected retryLoad(): void {
    this.store.loadPlayers();
  }

  protected toggleExpanded(playerId: string): void {
    this.expandedPlayerId = this.expandedPlayerId === playerId ? null : playerId;
  }

  protected isExpanded(playerId: string): boolean {
    return this.expandedPlayerId === playerId;
  }

  protected tierColorClass(player: PlayerRow): string {
    const tier = this.resolveTierValue(player, this.store.tierSource(), true);
    return getTierColorClass(tier);
  }

  protected selectedTierValue(player: PlayerRow, positional: boolean): number | null {
    return this.resolveTierValue(player, this.store.tierSource(), positional);
  }

  protected secondaryTierText(player: PlayerRow, positional: boolean): string {
    const source = this.store.tierSource();
    if (source === "average") {
      return `Flock: ${this.formatTier(this.resolveTierValue(player, "flock", positional))}, KTC: ${this.formatTier(this.resolveTierValue(player, "ktc", positional))}`;
    }

    if (source === "flock") {
      return `KTC: ${this.formatTier(this.resolveTierValue(player, "ktc", positional))}, Avg: ${this.formatTier(this.resolveTierValue(player, "average", positional))}`;
    }

    return `Flock: ${this.formatTier(this.resolveTierValue(player, "flock", positional))}, Avg: ${this.formatTier(this.resolveTierValue(player, "average", positional))}`;
  }

  protected selectedValue(player: PlayerRow): number | null {
    const source = this.store.valueSource();
    return source === "ktcValue" ? player.ktcValue : player.averageRank;
  }

  protected selectedValueLabel(): string {
    return this.store.valueSource() === "ktcValue" ? "KTC Value" : "Flock Average Rank";
  }

  protected playerDetailItems(player: PlayerRow): PlayerDetailGridItem[] {
    return [
      { label: "Rookie", value: player.rookie ? "Yes" : "No" },
      { label: "Sleeper Rank", value: this.formatNullable(player.sleeperRank) },
      {
        label: "Overall Tier",
        value: this.formatNullable(this.selectedTierValue(player, false)),
        subtext: `(${this.secondaryTierText(player, false)})`,
      },
      {
        label: "Positional Tier",
        value: this.formatNullable(this.selectedTierValue(player, true)),
        subtext: `(${this.secondaryTierText(player, true)})`,
      },
      { label: "KTC Rank", value: this.formatNullable(player.ktcRank) },
      { label: this.selectedValueLabel(), value: this.formatNullable(this.selectedValue(player)) },
    ];
  }

  private resolveTierValue(
    player: PlayerRow,
    source: TierSource,
    positional: boolean,
  ): number | null {
    const ktcTier = positional ? player.positionalTier : player.overallTier;
    const flockTier = positional ? player.flockAveragePositionalTier : player.flockAverageTier;
    return resolveTier(ktcTier, flockTier, source);
  }

  private formatTier(value: number | null): string {
    return value === null ? "-" : String(value);
  }

  private formatNullable(value: number | null | undefined): string {
    return value === null || value === undefined ? "-" : String(value);
  }
}
