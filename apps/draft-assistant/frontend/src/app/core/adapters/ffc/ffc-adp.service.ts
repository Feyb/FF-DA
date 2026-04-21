import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, catchError, map, of, shareReplay } from "rxjs";
import { FfcAdpPlayer } from "../../models";
import { normalizeName as normalizeNameUtil } from "../../utils/name-normalization.util";

// FantasyFootballCalculator ADP (with stddev) is pre-fetched at build time.
// To refresh, run: pnpm run ffc:sync
const FFC_ASSETS: Record<FfcAdpFormat, string> = {
  "half-ppr": "assets/ffc/adp-half-ppr-12team.json",
  ppr: "assets/ffc/adp-ppr-12team.json",
  standard: "assets/ffc/adp-standard-12team.json",
  superflex: "assets/ffc/adp-superflex-12team.json",
  dynasty: "assets/ffc/adp-dynasty-12team.json",
  rookie: "assets/ffc/adp-rookie-12team.json",
};

export type FfcAdpFormat = "half-ppr" | "ppr" | "standard" | "superflex" | "dynasty" | "rookie";

@Injectable({ providedIn: "root" })
export class FfcAdpService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<FfcAdpFormat, Observable<FfcAdpPlayer[]>>();

  getAdp(format: FfcAdpFormat): Observable<FfcAdpPlayer[]> {
    const cached = this.cache.get(format);
    if (cached) return cached;

    const obs$ = this.http.get<FfcAdpPlayer[]>(FFC_ASSETS[format]).pipe(
      map((players) => (Array.isArray(players) ? players : [])),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(format, obs$);
    return obs$;
  }

  buildNameLookup(players: FfcAdpPlayer[]): Map<string, FfcAdpPlayer> {
    return new Map(players.map((p) => [this.normalizeName(p.playerName), p]));
  }

  normalizeName(name: string): string {
    return normalizeNameUtil(name);
  }
}
