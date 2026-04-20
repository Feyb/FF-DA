import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, catchError, map, of, shareReplay } from "rxjs";
import { FantasyCalcPlayer } from "../../models";
import { normalizeName as normalizeNameUtil } from "../../utils/name-normalization.util";

// FantasyCalc values are pre-fetched at build time and served as bundled
// static JSON. To refresh, run: pnpm run fc:sync
const FC_ASSET_1QB_DYNASTY = "assets/fantasycalc/values-1qb-dynasty.json";
const FC_ASSET_SF_DYNASTY = "assets/fantasycalc/values-superflex-dynasty.json";
const FC_ASSET_1QB_REDRAFT = "assets/fantasycalc/values-1qb-redraft.json";
const FC_ASSET_SF_REDRAFT = "assets/fantasycalc/values-superflex-redraft.json";

export type FantasyCalcFormat =
  | "1qb-dynasty"
  | "superflex-dynasty"
  | "1qb-redraft"
  | "superflex-redraft";

@Injectable({ providedIn: "root" })
export class FantasyCalcService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<FantasyCalcFormat, Observable<FantasyCalcPlayer[]>>();

  getValues(format: FantasyCalcFormat): Observable<FantasyCalcPlayer[]> {
    const cached = this.cache.get(format);
    if (cached) return cached;

    const url = this.assetUrl(format);
    const obs$ = this.http.get<FantasyCalcPlayer[]>(url).pipe(
      map((players) => (Array.isArray(players) ? players : [])),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(format, obs$);
    return obs$;
  }

  buildNameLookup(players: FantasyCalcPlayer[]): Map<string, FantasyCalcPlayer> {
    return new Map(players.map((p) => [this.normalizeName(p.playerName), p]));
  }

  /** Build a sleeperId -> player lookup; FC ships sleeperId for most active players. */
  buildSleeperIdLookup(players: FantasyCalcPlayer[]): Map<string, FantasyCalcPlayer> {
    const lookup = new Map<string, FantasyCalcPlayer>();
    for (const p of players) {
      if (p.sleeperId) lookup.set(p.sleeperId, p);
    }
    return lookup;
  }

  normalizeName(name: string): string {
    return normalizeNameUtil(name);
  }

  private assetUrl(format: FantasyCalcFormat): string {
    switch (format) {
      case "1qb-dynasty":
        return FC_ASSET_1QB_DYNASTY;
      case "superflex-dynasty":
        return FC_ASSET_SF_DYNASTY;
      case "1qb-redraft":
        return FC_ASSET_1QB_REDRAFT;
      case "superflex-redraft":
        return FC_ASSET_SF_REDRAFT;
    }
  }
}
