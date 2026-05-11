import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { NgClass, NgStyle } from "@angular/common";
import {
  DraftPlayerRow,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
} from "../../../core/models";
import {
  GridCell,
  GridRow,
  GridTeamHeader,
  buildGridHeaders,
  buildGridRows,
} from "./draft-board-grid.util";
import { PLAYER_FALLBACK_IMAGE } from "../../../core/constants/images.constants";

export type { GridCell, GridRow, GridTeamHeader };

@Component({
  selector: "app-draft-board-grid",
  standalone: true,
  templateUrl: "./draft-board-grid.component.html",
  styleUrl: "./draft-board-grid.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgStyle],
})
export class DraftBoardGridComponent {
  readonly draft = input.required<SleeperDraft>();
  readonly picks = input<SleeperDraftPick[]>([]);
  readonly tradedPicks = input<SleeperTradedPick[]>([]);
  readonly rosterDisplayNames = input<Record<string, string>>({});
  readonly rosterAvatarIds = input<Record<string, string | null>>({});
  readonly playerNameMap = input<Record<string, string>>({});
  readonly rows = input<DraftPlayerRow[]>([]);
  readonly currentUserId = input<string | null>(null);
  readonly isLoading = input<boolean>(false);

  protected readonly fallbackAvatar = PLAYER_FALLBACK_IMAGE;

  protected readonly teamCount = computed(() => {
    const v = this.draft().settings?.["teams"];
    return typeof v === "number" && v > 0 ? v : 0;
  });

  protected readonly tierByPlayerId = computed((): Map<string, number | null> => {
    const m = new Map<string, number | null>();
    for (const row of this.rows()) {
      m.set(row.playerId, row.positionalTier ?? row.overallTier ?? null);
    }
    return m;
  });

  protected readonly fpAdpRankByPlayerId = computed((): Map<string, number | null> => {
    const m = new Map<string, number | null>();
    for (const row of this.rows()) {
      m.set(row.playerId, row.fpAdpRank);
    }
    return m;
  });

  protected readonly headers = computed<GridTeamHeader[]>(() =>
    buildGridHeaders(
      this.draft(),
      this.rosterDisplayNames(),
      this.rosterAvatarIds(),
      this.currentUserId(),
    ),
  );

  protected readonly gridRows = computed<GridRow[]>(() =>
    buildGridRows(
      this.draft(),
      this.picks(),
      this.playerNameMap(),
      this.tierByPlayerId(),
      this.currentUserId(),
      this.tradedPicks(),
      this.rosterDisplayNames(),
    ),
  );

  protected readonly gridColumnsStyle = computed(
    () => `repeat(${this.teamCount()}, minmax(0, 1fr))`,
  );

  protected readonly skeletonColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected avatarUrl(avatarId: string | null): string | null {
    return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;
  }

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onImgError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.fallbackAvatar) {
      img.src = this.fallbackAvatar;
    }
  }

  protected positionClass(pos: string | null): string {
    switch (pos?.toUpperCase()) {
      case "QB":
        return "pos-qb";
      case "RB":
        return "pos-rb";
      case "WR":
        return "pos-wr";
      case "TE":
        return "pos-te";
      default:
        return "";
    }
  }

  protected tierClass(tier: number | null): string {
    if (tier === null) return "";
    const t = Math.max(1, Math.min(tier, 10));
    return `tier-${((t - 1) % 10) + 1}`;
  }
}
