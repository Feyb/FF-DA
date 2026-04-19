import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { NgClass } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { PLAYER_FALLBACK_IMAGE } from "../../../core/constants/images.constants";
import { PlayerCardData, SleeperPlayerStats } from "../../../core/models";

interface StatChip {
  label: string;
  value: string;
}

@Component({
  selector: "app-player-card",
  templateUrl: "./player-card.component.html",
  styleUrl: "./player-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatButtonModule, MatIconModule],
})
export class PlayerCardComponent {
  // ── Required ──────────────────────────────────────────────────────────────────
  readonly player = input.required<PlayerCardData>();

  // ── Stats (optional – shown as second row when provided) ─────────────────────
  readonly stats = input<SleeperPlayerStats | null>(null);

  // ── Display options ───────────────────────────────────────────────────────────
  /** CSS class string for the tier coloring applied to the card border. */
  readonly tierColorClass = input<string>("");
  /** Rank number displayed in the card header (e.g., the list position). */
  readonly rank = input<number | null>(null);
  /** Short label prefix shown before the rank number (e.g. "KTC", "Flock", "CT"). */
  readonly rankLabel = input<string>("");

  // ── Draft-specific (all optional) ─────────────────────────────────────────────
  readonly isDrafted = input<boolean>(false);
  readonly availabilityRisk = input<"safe" | "at-risk" | "gone">("safe");
  readonly isGoingSoon = input<boolean>(false);
  readonly adpDelta = input<number | null>(null);
  readonly valueGap = input<number | null>(null);

  // ── Star / bookmark ───────────────────────────────────────────────────────────
  readonly showStar = input<boolean>(false);
  readonly starred = input<boolean>(false);

  readonly starToggle = output<string>();

  // ── Internal ──────────────────────────────────────────────────────────────────
  protected readonly fallbackImage = PLAYER_FALLBACK_IMAGE;

  protected readonly positionClass = computed(() => {
    const pos = this.player().position?.toLowerCase() ?? "";
    return pos ? `pos-accent-${pos}` : "";
  });

  protected readonly statChips = computed((): StatChip[] => {
    const s = this.stats();
    if (!s) return [];
    const pos = this.player().position;

    if (pos === "QB") {
      const cmpPct = s.pass_att > 0 ? `${Math.round((s.pass_cmp / s.pass_att) * 100)}%` : "—";
      return [
        { label: "Pass Yds", value: String(s.pass_yd) },
        { label: "Pass TDs", value: String(s.pass_td) },
        { label: "INT", value: String(s.pass_int) },
        { label: "CMP%", value: cmpPct },
      ];
    }

    if (pos === "RB") {
      return [
        { label: "Rush Yds", value: String(s.rush_yd) },
        { label: "Rush TDs", value: String(s.rush_td) },
        { label: "Rec", value: String(s.rec) },
        { label: "Rec Yds", value: String(s.rec_yd) },
      ];
    }

    // WR / TE
    return [
      { label: "Rec", value: String(s.rec) },
      { label: "Rec Yds", value: String(s.rec_yd) },
      { label: "Rec TDs", value: String(s.rec_td) },
      { label: "Targets", value: String(s.tar) },
    ];
  });

  protected readonly adpDeltaLabel = computed((): string => {
    const delta = this.adpDelta();
    if (delta === null) return "";
    if (delta > 0) return `+${delta}`;
    return String(delta);
  });

  protected readonly adpDeltaClass = computed((): string => {
    const delta = this.adpDelta();
    if (delta === null) return "";
    if (delta > 1) return "adp-value";
    if (delta < -1) return "adp-reach";
    return "adp-neutral";
  });

  protected readonly valueGapClass = computed((): string => {
    const gap = this.valueGap();
    if (gap === null) return "vg-none";
    if (gap === 0) return "vg-consensus";
    if (gap === 1) return "vg-minor";
    return "vg-high";
  });

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.fallbackImage) return;
    img.src = this.fallbackImage;
  }

  protected onStarClick(): void {
    this.starToggle.emit(this.player().playerId);
  }
}
