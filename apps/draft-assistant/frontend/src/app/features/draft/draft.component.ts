import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { SleeperDraft } from "../../core/models";
import { AppStore } from "../../core/state/app.store";
import { DraftSourceMode, DraftStore } from "./draft.store";
import { DraftBoardGridComponent } from "./draft-board-grid/draft-board-grid.component";
import { PageHeaderComponent } from "../../shared/components/page-header";
import { LoadingStateComponent } from "../../shared/components/loading-state";
import { ErrorStateComponent } from "../../shared/components/error-state";
import { DraftControlsCardComponent } from "./draft-controls-card/draft-controls-card.component";
import { BestAvailableCardComponent } from "./best-available-card/best-available-card.component";
import { DraftPlayerListComponent } from "./draft-player-list/draft-player-list.component";
import { DraftTierAlertsComponent } from "./draft-tier-alerts/draft-tier-alerts.component";
import { DraftSidebarComponent } from "./draft-sidebar/draft-sidebar.component";
import { getSleeperDraftTypeLabel } from "../../core/adapters/sleeper/sleeper-draft.util";

@Component({
  selector: "app-draft",
  templateUrl: "./draft.component.html",
  styleUrl: "./draft.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DraftStore],
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DraftBoardGridComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    DraftControlsCardComponent,
    BestAvailableCardComponent,
    DraftPlayerListComponent,
    DraftTierAlertsComponent,
    DraftSidebarComponent,
  ],
})
export class DraftComponent {
  protected readonly store = inject(DraftStore);
  protected readonly appStore = inject(AppStore);

  protected readonly activeSourceMode = computed<DraftSourceMode>(
    () => this.store.draftSource() ?? "league",
  );
  protected readonly sourceLabel = computed<string>(() =>
    this.activeSourceMode() === "direct" ? "Direct URL" : "League Draft",
  );

  protected picksUntilMyTurnLabel(): string {
    const nextPick = this.store.userNextPickNumber();
    if (!nextPick) return "";
    const currentPick = this.store.picks().length + 1;
    const picks = nextPick - currentPick;
    if (picks === 0) return "Your pick now!";
    if (picks === 1) return "1 pick until your turn";
    return `${picks} picks until your turn`;
  }

  protected draftSetting(draft: SleeperDraft, key: string): string {
    const raw = draft.settings?.[key];
    if (raw === undefined || raw === null || raw === "") return "-";
    return String(raw);
  }

  protected draftTypeLabel(draft: SleeperDraft): string {
    return getSleeperDraftTypeLabel(draft);
  }

  protected retryLoad(): void {
    this.store.retry();
  }
}
