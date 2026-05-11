import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, of, shareReplay } from "rxjs";

/** Collegiate metrics used by rookie-score.util.ts. Defined here to avoid a core→feature dependency. */
export interface CfbdMetrics {
  /** Dominator Rating (college target/carry share × scoring share). 0–1 typical range. */
  dominatorRating: number | null;
  /** Age at first 20% Dominator Rating season (lower = earlier breakout). */
  breakoutAge: number | null;
  /** Yards per team pass attempt in final college season. */
  yptpa: number | null;
  /** Relative Athletic Score — composite of combine metrics, 0–10. */
  ras: number | null;
}

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

interface CfbdCandidate {
  season: number;
  metrics: CfbdMetrics;
}

/** Normalize a player name for fuzzy lookup across feeds with inconsistent suffixes. */
export function normalizeCfbdName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function countKnownMetrics(metrics: CfbdMetrics): number {
  let known = 0;
  if (metrics.dominatorRating !== null) known += 1;
  if (metrics.breakoutAge !== null) known += 1;
  if (metrics.yptpa !== null) known += 1;
  if (metrics.ras !== null) known += 1;
  return known;
}

function shouldReplaceCandidate(existing: CfbdCandidate, incoming: CfbdCandidate): boolean {
  const existingKnown = countKnownMetrics(existing.metrics);
  const incomingKnown = countKnownMetrics(incoming.metrics);
  if (incomingKnown !== existingKnown) return incomingKnown > existingKnown;
  return incoming.season > existing.season;
}

export function buildCfbdMetricsByName(players: CfbdAssetPlayer[]): Map<string, CfbdMetrics> {
  const byName = new Map<string, CfbdCandidate>();

  for (const p of players) {
    const key = normalizeCfbdName(p.player_name);
    const season = Number.isFinite(p.season) ? p.season : Number.MIN_SAFE_INTEGER;
    const incoming: CfbdCandidate = {
      season,
      metrics: {
        dominatorRating: p.dominator_rating,
        breakoutAge: p.breakout_age,
        yptpa: p.yptpa,
        ras: p.ras,
      },
    };
    const existing = byName.get(key);
    if (!existing || shouldReplaceCandidate(existing, incoming)) {
      byName.set(key, incoming);
    }
  }

  const output = new Map<string, CfbdMetrics>();
  for (const [key, value] of byName) {
    output.set(key, value.metrics);
  }
  return output;
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
      map((envelope) => buildCfbdMetricsByName(envelope.players)),
      catchError(() => of(new Map<string, CfbdMetrics>())),
      shareReplay(1),
    );
}
