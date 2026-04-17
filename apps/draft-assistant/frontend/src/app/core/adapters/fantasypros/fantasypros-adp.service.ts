import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, catchError, map, of, shareReplay } from "rxjs";
import { FantasyProsPlayer } from "../../models";
import { normalizeName as normalizeNameUtil } from "../../utils/name-normalization.util";

// FantasyPros ADP data is pre-fetched during the CI build and served as bundled static
// JSON assets. To refresh with live data, set FANTASYPROS_API_KEY in the environment and
// run: pnpm run fp:sync
const FP_ASSET_1QB_URL = "assets/fantasypros/players-1qb.json";
const FP_ASSET_SUPERFLEX_URL = "assets/fantasypros/players-superflex.json";

@Injectable({ providedIn: "root" })
export class FantasyProsAdpService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<FantasyProsPlayer[]>>();

  /** Fetch FantasyPros dynasty ADP rankings for the 1QB format. */
  get1QBADPRankings(): Observable<FantasyProsPlayer[]> {
    return this.fetchPlayers(false);
  }

  /** Fetch FantasyPros dynasty ADP rankings for the Superflex/2QB format. */
  getSuperflexADPRankings(): Observable<FantasyProsPlayer[]> {
    return this.fetchPlayers(true);
  }

  private fetchPlayers(superflex: boolean): Observable<FantasyProsPlayer[]> {
    const cacheKey = superflex ? "superflex" : "1qb";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const assetUrl = superflex ? FP_ASSET_SUPERFLEX_URL : FP_ASSET_1QB_URL;
    const obs$ = this.http.get<FantasyProsPlayer[]>(assetUrl).pipe(
      map((players) => (Array.isArray(players) ? players : [])),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(cacheKey, obs$);
    return obs$;
  }

  buildNameLookup(players: FantasyProsPlayer[]): Map<string, FantasyProsPlayer> {
    return new Map(players.map((player) => [this.normalizeName(player.playerName), player]));
  }

  normalizeName(name: string): string {
    return normalizeNameUtil(name);
  }
}
