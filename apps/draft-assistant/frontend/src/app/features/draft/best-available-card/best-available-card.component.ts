import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BestAvailableEntry, DraftStore, rankForSortSource } from "../draft.store";
import { adpDeltaClass, adpDeltaLabel, sortSourceRankLabel } from "../draft-display.util";
import { TierLegendComponent } from "../../../shared/components/tier-legend";
import { TierColorPipe } from "../../../shared/pipes";

@Component({
  selector: "app-best-available-card",
  templateUrl: "./best-available-card.component.html",
  styleUrl: "./best-available-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule, MatIconModule, TierLegendComponent, TierColorPipe],
})
export class BestAvailableCardComponent {
  protected readonly store = inject(DraftStore);

  protected adpDeltaLabel(delta: number | null): string {
    return adpDeltaLabel(delta);
  }

  protected adpDeltaClass(delta: number | null): string {
    return adpDeltaClass(delta);
  }

  protected sortSourceRankLabel(): string {
    return sortSourceRankLabel(this.store.sortSource());
  }

  protected bestAvailableRank(entry: BestAvailableEntry): number | null {
    return entry.player ? rankForSortSource(entry.player, this.store.sortSource()) : null;
  }

  protected wcsExplanation(entry: BestAvailableEntry): string {
    if (!entry.player) return "";
    return this.store.wcsExplanationByPlayer().get(entry.player.playerId) ?? "";
  }
}
