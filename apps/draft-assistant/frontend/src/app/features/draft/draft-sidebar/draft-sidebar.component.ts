import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatChipsModule } from "@angular/material/chips";
import { MatIconModule } from "@angular/material/icon";
import {
  getSleeperDraftNameLabel,
  getSleeperDraftScoringLabel,
  getSleeperDraftStatusLabel,
  getSleeperDraftTypeLabel,
  getSleeperUserDraftPosition,
  SleeperUserDraftPosition,
} from "../../../core/adapters/sleeper/sleeper-draft.util";
import { SleeperDraft } from "../../../core/models";
import { AppStore } from "../../../core/state/app.store";
import { DraftStore, DraftSourceMode, PositionalNeedEntry } from "../draft.store";
import { DraftStrategyCurveComponent } from "../draft-strategy-curve/draft-strategy-curve.component";

@Component({
  selector: "app-draft-sidebar",
  templateUrl: "./draft-sidebar.component.html",
  styleUrl: "./draft-sidebar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    DraftStrategyCurveComponent,
  ],
})
export class DraftSidebarComponent {
  protected readonly store = inject(DraftStore);
  protected readonly appStore = inject(AppStore);

  protected readonly sourceLabel = computed<string>(() => {
    const mode: DraftSourceMode = this.store.draftSource() ?? "league";
    return mode === "direct" ? "Direct URL" : "League Draft";
  });

  protected needLabel(need: PositionalNeedEntry): string {
    return `${need.remaining}/${need.configured}`;
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected adpDeltaLabel(delta: number | null): string {
    if (delta === null) return "—";
    if (delta > 0) return `+${delta}`;
    return String(delta);
  }

  protected adpDeltaClass(delta: number | null): string {
    if (delta === null) return "";
    if (delta > 1) return "adp-value";
    if (delta < -1) return "adp-reach";
    return "adp-neutral";
  }

  protected draftNameLabel(draft: SleeperDraft): string {
    return getSleeperDraftNameLabel(draft);
  }

  protected draftStatusLabel(draft: SleeperDraft): string {
    return getSleeperDraftStatusLabel(draft);
  }

  protected draftTypeLabel(draft: SleeperDraft): string {
    return getSleeperDraftTypeLabel(draft);
  }

  protected draftScoringLabel(draft: SleeperDraft): string {
    return getSleeperDraftScoringLabel(draft, this.draftLeague(draft));
  }

  protected draftSetting(draft: SleeperDraft, key: string): string {
    const raw = draft.settings?.[key];
    if (raw === undefined || raw === null || raw === "") return "-";
    return String(raw);
  }

  protected draftStartLabel(draft: SleeperDraft): string {
    if (!draft.start_time) return "-";
    return new Date(draft.start_time).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  protected userDraftPositionLabel(draft: SleeperDraft): string {
    return this.userDraftPosition(draft)?.label ?? "-";
  }

  protected userDraftSlotLabel(draft: SleeperDraft): string {
    const position = this.userDraftPosition(draft);
    return position === null ? "-" : String(position.slot);
  }

  private draftLeague(draft: SleeperDraft) {
    const selectedLeague = this.appStore.selectedLeague();
    if (!selectedLeague) return null;
    if (!draft.league_id || draft.league_id === selectedLeague.league_id) return selectedLeague;
    return null;
  }

  private userDraftPosition(draft: SleeperDraft): SleeperUserDraftPosition | null {
    return getSleeperUserDraftPosition(draft, this.appStore.user()?.user_id);
  }
}
