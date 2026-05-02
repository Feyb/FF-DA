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

  /** WCS (Weighted Composite Score) value; shown as a colored pill badge. */
  readonly wcsScore = input<number | null>(null);
  /** Positional rank from the active sort source (e.g. 12 → "WR12"). */
  readonly positionRank = input<number | null>(null);
  /** True when the player is a current-year rookie. */
  readonly isRookie = input<boolean>(false);
  /** Injury designation string (e.g. "Out", "Questionable", "IR"). */
  readonly injuryStatus = input<string | null>(null);
  /** FantasyCalc 30-day value trend; positive = trending up. */
  readonly trendingAdds = input<number | null>(null);
  /** Efficiency letter grade derived from the player's EffScore (A+, A, B, C, D). */
  readonly effGrade = input<string | null>(null);
  /** WCS explanation text shown below the pills row. */
  readonly explanation = input<string | null>(null);

  // ── Star / bookmark ───────────────────────────────────────────────────────────
  readonly showStar = input<boolean>(false);
  readonly starred = input<boolean>(false);

  /** When true, the whole card acts as a button and emits cardClick on click / Enter / Space. */
  readonly clickable = input<boolean>(false);

  readonly starToggle = output<string>();
  /** Emits the player's Sleeper ID when the card is clicked (only when clickable=true). */
  readonly cardClick = output<string>();

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

  protected readonly wcsDisplay = computed((): string | null => {
    const s = this.wcsScore();
    return s !== null ? String(Math.round(s)) : null;
  });

  protected readonly wcsColorClass = computed((): string => {
    const s = this.wcsScore();
    if (s === null) return "";
    if (s >= 90) return "wcs-high";
    if (s >= 55) return "wcs-mid";
    return "wcs-low";
  });

  protected readonly effGradePillClass = computed((): string => {
    const g = this.effGrade();
    if (!g) return "";
    if (g === "A+" || g === "A") return "eff-high";
    if (g === "B") return "eff-mid";
    if (g === "C") return "eff-neutral";
    return "eff-low";
  });

  protected readonly injuryBadgeLabel = computed((): string | null => {
    const s = this.injuryStatus();
    if (!s) return null;
    const u = s.toUpperCase();
    if (u === "IR") return "IR";
    if (u === "PUP") return "PUP";
    if (u === "OUT" || u === "O") return "Out";
    if (u === "DOUBTFUL" || u === "D") return "Dbt";
    if (u === "QUESTIONABLE" || u === "Q") return "Q";
    return null;
  });

  protected readonly injuryBadgeClass = computed((): string => {
    const u = (this.injuryStatus() ?? "").toUpperCase();
    if (u === "IR" || u === "PUP" || u === "OUT" || u === "O") return "injury-out";
    if (u === "DOUBTFUL" || u === "D") return "injury-doubtful";
    if (u === "QUESTIONABLE" || u === "Q") return "injury-questionable";
    return "";
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

  protected onStarClick(event: Event): void {
    event.stopPropagation();
    this.starToggle.emit(this.player().playerId);
  }

  protected onCardClick(): void {
    if (this.clickable()) this.cardClick.emit(this.player().playerId);
  }

  protected onCardKeydown(event: KeyboardEvent): void {
    if (!this.clickable()) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.cardClick.emit(this.player().playerId);
    }
  }
}
