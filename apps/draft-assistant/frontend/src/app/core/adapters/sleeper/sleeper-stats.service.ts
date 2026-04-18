import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, catchError, map, of, shareReplay } from "rxjs";
import { SleeperPlayerStats } from "../../models";

@Injectable({ providedIn: "root" })
export class SleeperStatsService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<number, Observable<Map<string, SleeperPlayerStats>>>();

  /**
   * Load season stats for the given year from the bundled static asset.
   * Returns an empty map when the asset is unavailable (script not yet run).
   *
   * Results are cached per year for the lifetime of the service.
   */
  fetchStats(year: number): Observable<Map<string, SleeperPlayerStats>> {
    const cached = this.cache.get(year);
    if (cached) return cached;

    const obs$ = this.http
      .get<Record<string, SleeperPlayerStats>>(`assets/sleeper-stats/players-${year}.json`)
      .pipe(
        map((raw) => {
          const result = new Map<string, SleeperPlayerStats>();
          for (const [id, stats] of Object.entries(raw ?? {})) {
            result.set(id, stats);
          }
          return result;
        }),
        catchError((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[SleeperStatsService] stats asset unavailable for year ${year}: ${msg}`);
          return of(new Map<string, SleeperPlayerStats>());
        }),
        shareReplay(1),
      );

    this.cache.set(year, obs$);
    return obs$;
  }
}
