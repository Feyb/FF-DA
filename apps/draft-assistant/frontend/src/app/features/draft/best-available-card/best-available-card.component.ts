import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BestAvailableEntry, DraftStore, rankForSortSource } from "../draft.store";
import {
  adpDeltaClass,
  adpDeltaLabel,
  effGradeFromScore,
  sortSourceShortLabel,
} from "../draft-display.util";
import { TierLegendComponent } from "../../../shared/components/tier-legend";
import { TierColorPipe } from "../../../shared/pipes";
import { PLAYER_FALLBACK_IMAGE } from "../../../core/constants/images.constants";
import { PickExplanationComponent } from "../pick-explanation/pick-explanation.component";

@Component({
  selector: "app-best-available-card",
  templateUrl: "./best-available-card.component.html",
  styleUrl: "./best-available-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DecimalPipe,
    MatCardModule,
    MatIconModule,
    TierLegendComponent,
    TierColorPipe,
    PickExplanationComponent,
  ],
})
export class BestAvailableCardComponent {
  protected readonly store = inject(DraftStore);
  protected readonly fallbackImage = PLAYER_FALLBACK_IMAGE;

  protected adpDeltaLabel(delta: number | null): string {
    return adpDeltaLabel(delta);
  }

  protected adpDeltaClass(delta: number | null): string {
    return adpDeltaClass(delta);
  }

  protected sortSourceShortLabel(): string {
    return sortSourceShortLabel(this.store.sortSource());
  }

  protected bestAvailableRank(entry: BestAvailableEntry): number | null {
    return entry.player ? rankForSortSource(entry.player, this.store.sortSource()) : null;
  }

  protected wcsExplanation(entry: BestAvailableEntry): string {
    if (!entry.player) return "";
    return this.store.wcsExplanationByPlayer().get(entry.player.playerId) ?? "";
  }

  protected wcsDisplay(entry: BestAvailableEntry): string | null {
    const score = entry.player?.weightedCompositeScore ?? null;
    return score !== null ? String(Math.round(score)) : null;
  }

  protected wcsColorClass(entry: BestAvailableEntry): string {
    const score = entry.player?.weightedCompositeScore ?? null;
    if (score === null) return "";
    if (score >= 90) return "wcs-high";
    if (score >= 55) return "wcs-mid";
    return "wcs-low";
  }

  protected effGradeForPlayer(entry: BestAvailableEntry): string | null {
    if (!entry.player) return null;
    return effGradeFromScore(this.store.effScoreByPlayer().get(entry.player.playerId));
  }

  protected effGradeClass(grade: string): string {
    if (grade === "A+" || grade === "A") return "eff-high";
    if (grade === "B") return "eff-mid";
    if (grade === "C") return "eff-neutral";
    return "eff-low";
  }

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.fallbackImage) return;
    img.src = this.fallbackImage;
  }

  /** MC survival rate for this entry — only present when tie-break simulation ran. */
  protected mcSurvivalRate(entry: BestAvailableEntry): number | null {
    if (!entry.player) return null;
    return this.store.mcConfidenceByPlayer().get(entry.player.playerId) ?? null;
  }
}
