import { ChangeDetectionStrategy, Component, computed, HostListener, inject } from "@angular/core";
import { NgClass } from "@angular/common";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs/operators";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { DraftStore } from "../draft.store";
import { AppStore } from "../../../core/state/app.store";
import { SleeperStatsService } from "../../../core/adapters/sleeper/sleeper-stats.service";
import { normalizeCfbdName } from "../../../core/adapters/cfbd/cfbd.service";
import { PLAYER_FALLBACK_IMAGE } from "../../../core/constants/images.constants";
import { SleeperPlayerStats } from "../../../core/models";

@Component({
  selector: "app-player-detail-drawer",
  templateUrl: "./player-detail-drawer.component.html",
  styleUrl: "./player-detail-drawer.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[class.open]": "store.selectedDetailPlayerId() !== null" },
  imports: [NgClass, MatButtonModule, MatIconModule, MatTooltipModule],
})
export class PlayerDetailDrawerComponent {
  protected readonly store = inject(DraftStore);
  private readonly appStore = inject(AppStore);
  private readonly statsService = inject(SleeperStatsService);

  protected readonly fallbackImage = PLAYER_FALLBACK_IMAGE;

  private readonly seasonYear = computed(() => {
    const season = this.appStore.selectedLeague()?.season;
    return season ? Number(season) : new Date().getUTCFullYear() - 1;
  });

  private readonly statsMap = toSignal(
    toObservable(this.seasonYear).pipe(switchMap((year) => this.statsService.fetchStats(year))),
    { initialValue: new Map<string, SleeperPlayerStats>() },
  );

  protected readonly detail = computed(() => {
    const id = this.store.selectedDetailPlayerId();
    if (!id) return null;
    const row = this.store.enrichedRows().find((r) => r.playerId === id) ?? null;
    if (!row) return null;

    const gsisId = this.store.nflverseGsisIdByName().get(normalizeCfbdName(row.fullName));
    const nflStats = gsisId ? this.store.playerStatsMap().get(gsisId) : null;
    const pfrStats = gsisId ? this.store.pfrStatsMap().get(gsisId) : null;
    const ngsStats = gsisId ? this.store.ngsStatsMap().get(gsisId) : null;
    const ffOpp = gsisId ? this.store.ffOppMap().get(gsisId) : null;

    return {
      row,
      seasonStats: this.statsMap().get(id) ?? null,
      nflStats: nflStats ?? null,
      pfrStats: pfrStats ?? null,
      ngsStats: ngsStats ?? null,
      ffOpp: ffOpp ?? null,
      contextMod: this.store.contextModByPlayer().get(id) ?? null,
      needMult: this.store.needMultiplierByPlayer().get(id) ?? null,
      runHeat: this.store.runHeatByPlayer().get(id) ?? null,
      vnp: this.store.vnpByPlayer().get(id) ?? null,
      mc: this.store.mcConfidenceByPlayer().get(id) ?? null,
      eff: this.store.effScoreByPlayer().get(id) ?? null,
    };
  });

  @HostListener("document:keydown.escape")
  close(): void {
    this.store.selectDetailPlayer(null);
  }

  protected headshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackImage;
  }

  protected fmtNum(val: number | null | undefined, decimals = 0): string {
    if (val == null || !isFinite(val)) return "—";
    return val.toFixed(decimals);
  }

  protected fmtPct(val: number | null | undefined): string {
    if (val == null || !isFinite(val)) return "—";
    return `${Math.round(val * 100)}%`;
  }

  protected trendLabel(val: number | null | undefined): string {
    if (val == null) return "—";
    return val > 0 ? `+${val}` : String(val);
  }

  protected trendClass(val: number | null | undefined): string {
    if (val == null) return "";
    return val > 0 ? "trend-up" : val < 0 ? "trend-down" : "";
  }

  protected effGradeLabel(eff: number | null): string {
    if (eff === null) return "—";
    if (eff >= 1.5) return "A+";
    if (eff >= 0.75) return "A";
    if (eff >= 0) return "B";
    if (eff >= -0.75) return "C";
    return "D";
  }

  protected effGradeClass(eff: number | null): string {
    if (eff === null) return "";
    if (eff >= 0.75) return "eff-a";
    if (eff >= 0) return "eff-b";
    if (eff >= -0.75) return "eff-c";
    return "eff-d";
  }

  protected injuryClass(status: string | null): string {
    if (!status) return "";
    const s = status.toLowerCase();
    if (s === "out" || s === "ir") return "injury-out";
    if (s === "doubtful") return "injury-doubtful";
    if (s === "questionable") return "injury-q";
    return "injury-other";
  }
}
