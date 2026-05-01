import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, of, shareReplay } from "rxjs";
import { type CfbdMetrics } from "../../../features/draft/utils/rookie-score.util";

interface CfbdAssetPlayer {
  player_name: string;
  season: number;
  position: string | null;
  ras: number | null;
  dominator_rating: number | null;
  breakout_age: number | null;
  yptpa: number | null;
}

interface CfbdAssetEnvelope {
  generatedAt: string;
  players: CfbdAssetPlayer[];
}

/** Normalize a player name for fuzzy lookup (lowercase letters + digits only). */
export function normalizeCfbdName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

@Injectable({ providedIn: "root" })
export class CfbdService {
  private readonly http = inject(HttpClient);

  /**
   * CFBD rookie metrics keyed by normalized player name.
   * Returns CfbdMetrics (camelCase) for use with rookie-score.util.ts.
   */
  readonly rookieMetricsByName$: Observable<Map<string, CfbdMetrics>> = this.http
    .get<CfbdAssetEnvelope>("assets/cfbd/rookie-metrics.json")
    .pipe(
      map((envelope) => {
        const m = new Map<string, CfbdMetrics>();
        for (const p of envelope.players) {
          const key = normalizeCfbdName(p.player_name);
          m.set(key, {
            dominatorRating: p.dominator_rating,
            breakoutAge: p.breakout_age,
            yptpa: p.yptpa,
            ras: p.ras,
          });
        }
        return m;
      }),
      catchError(() => of(new Map<string, CfbdMetrics>())),
      shareReplay(1),
    );
}
