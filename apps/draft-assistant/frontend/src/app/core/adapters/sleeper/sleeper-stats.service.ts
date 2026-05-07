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
   * When the requested year's asset is missing (e.g. current year before
   * the season begins), falls back to `year - 1` one time before giving up.
   * Returns an empty map when neither asset is available.
   *
   * Results are cached per year for the lifetime of the service.
   */
  fetchStats(year: number, allowFallback = true): Observable<Map<string, SleeperPlayerStats>> {
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
          let msg: string;
          if (err instanceof Error) {
            msg = err.message;
          } else if (typeof err === "object" && err !== null && "message" in err) {
            const e = err as { message: unknown; status?: unknown };
            msg = `HTTP ${e.status ?? "?"}: ${e.message}`;
          } else {
            msg = String(err);
          }
          console.warn(`[SleeperStatsService] stats asset unavailable for year ${year}: ${msg}`);
          if (allowFallback) {
            console.info(`[SleeperStatsService] falling back to ${year - 1} stats`);
            return this.fetchStats(year - 1, false);
          }
          return of(new Map<string, SleeperPlayerStats>());
        }),
        shareReplay(1),
      );

    this.cache.set(year, obs$);
    return obs$;
  }
}
