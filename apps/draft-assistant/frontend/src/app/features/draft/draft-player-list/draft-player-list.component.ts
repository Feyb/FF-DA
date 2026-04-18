import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { toSignal, toObservable } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";
import { DraftPlayerRow, SleeperPlayerStats } from "../../../core/models";
import { PLAYER_FALLBACK_IMAGE } from "../../../core/constants/images.constants";
import { DraftPlayerDisplayRow, DraftStore, rankForSortSource } from "../draft.store";
import { sortSourceRankLabel } from "../draft-display.util";
import { getTierColorClass } from "../../../shared/pipes/tier-color.pipe";
import { SleeperStatsService } from "../../../core/adapters/sleeper/sleeper-stats.service";
import { AppStore } from "../../../core/state/app.store";
import { PlayerCardComponent } from "../../../shared/components/player-card";

@Component({
  selector: "app-draft-player-list",
  templateUrl: "./draft-player-list.component.html",
  styleUrl: "./draft-player-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PlayerCardComponent,
  ],
})
export class DraftPlayerListComponent {
  protected readonly store = inject(DraftStore);
  private readonly appStore = inject(AppStore);
  private readonly statsService = inject(SleeperStatsService);
  protected static readonly MAX_VISIBLE_PLAYERS = 120;
  protected readonly playerFallbackImage = PLAYER_FALLBACK_IMAGE;

  private readonly seasonYear = computed(() => {
    const season = this.appStore.selectedLeague()?.season;
    return season ? Number(season) : new Date().getFullYear() - 1;
  });

  protected readonly statsMap = toSignal(
    toObservable(this.seasonYear).pipe(switchMap((year) => this.statsService.fetchStats(year))),
    { initialValue: new Map<string, SleeperPlayerStats>() },
  );

  protected readonly visiblePlayerRows = computed(() =>
    this.store.allPlayerRows().slice(0, DraftPlayerListComponent.MAX_VISIBLE_PLAYERS),
  );
  protected readonly visibleUndraftedRows = computed(() =>
    this.visiblePlayerRows().filter((r) => !r.isDrafted),
  );
  protected readonly undraftedIndexMap = computed(() => {
    const map = new Map<string, number>();
    this.visibleUndraftedRows().forEach((r, i) => map.set(r.playerId, i));
    return map;
  });
  protected readonly userNextPickNumber = computed(() => this.store.userNextPickNumber());

  protected rowCombinedTier(row: DraftPlayerRow): number | null {
    return row.combinedTier;
  }

  protected rowRank(row: DraftPlayerRow): number | null {
    return rankForSortSource(row, this.store.sortSource());
  }

  protected tierColorClass(row: DraftPlayerDisplayRow): string {
    return row.isDrafted ? "" : getTierColorClass(row.combinedTier);
  }

  protected sortSourceRankLabel(): string {
    return sortSourceRankLabel(this.store.sortSource());
  }

  protected shouldShowTierDivider(
    undraftedRows: DraftPlayerDisplayRow[],
    undraftedIndex: number,
  ): boolean {
    if (undraftedIndex === 0) return true;
    const currentTier = undraftedRows[undraftedIndex]
      ? this.rowCombinedTier(undraftedRows[undraftedIndex])
      : null;
    const previousTier = undraftedRows[undraftedIndex - 1]
      ? this.rowCombinedTier(undraftedRows[undraftedIndex - 1])
      : null;
    return currentTier !== previousTier;
  }

  protected shouldShowNextPickDivider(
    undraftedRows: DraftPlayerDisplayRow[],
    undraftedIndex: number,
  ): boolean {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick || undraftedIndex === 0) return false;
    const pickedCount = this.store.picks().length;
    const picksBetweenNowAndUserPick = userNextPick - pickedCount - 1;
    return undraftedIndex === picksBetweenNowAndUserPick;
  }

  protected nextPickDividerLabel(): string {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick) return "Your next pick";

    const draft = this.store.selectedDraft();
    if (!draft?.settings?.["teams"]) return `Your next pick (#${userNextPick})`;

    const teams = draft.settings["teams"] as number;
    const round = Math.floor((userNextPick - 1) / teams) + 1;
    const pickInRound = ((userNextPick - 1) % teams) + 1;
    return `Your next pick (#${userNextPick} • R${round}.${String(pickInRound).padStart(String(teams).length, "0")})`;
  }

  protected tierDividerLabel(row: DraftPlayerRow): string {
    const tier = this.rowCombinedTier(row);
    return tier === null ? "Un-tiered" : `Tier ${tier}`;
  }

  protected toggleStar(playerId: string): void {
    this.store.toggleStar(playerId);
  }

  protected isStarred(playerId: string): boolean {
    return this.store.starredPlayerIds().includes(playerId);
  }

  protected toggleNeededPositionsOnly(): void {
    this.store.toggleNeededPositionsOnly();
  }
}
