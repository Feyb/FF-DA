import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, of, shareReplay } from "rxjs";

/** Slim nflverse player-stats record (seasonal totals, most recent season). */
export interface NflversePlayerStats {
  player_id: string;
  player_name: string;
  season: number;
  games: number;
  targets: number;
  receptions: number;
  target_share: number;
  air_yards_share: number;
  wopr: number;
  snap_pct: number;
  racr: number;
  receiving_yards: number;
  rushing_yards: number;
  rushing_attempts: number;
  rushing_tds: number;
  passing_yards: number;
  passing_tds: number;
}

/** pfr_advstats record. */
export interface NflversePfrStats {
  player_id: string;
  season: number;
  routes?: number;
  yprr?: number;
  tprr?: number;
  ybc_a?: number;
  yac_a?: number;
  broken_tackles?: number;
  drop_pct?: number;
}

/** Next Gen Stats record. */
export interface NflverseNgsStats {
  player_id: string;
  season: number;
  cpoe?: number;
  avg_intended_air_yards?: number;
  passer_rating?: number;
  rush_yards_over_expected_per_att?: number;
  avg_separation?: number;
  avg_cushion?: number;
  catch_percentage?: number;
}

/** ff_opportunity record. */
export interface NflverseFfOpportunity {
  player_id: string;
  season: number;
  xfp: number;
  weighted_opportunity: number;
  wopr_y?: number;
}

/** draft_picks record. */
export interface NflverseDraftPick {
  player_id: string;
  season: number;
  round: number | null;
  pick: number | null;
  position: string | null;
}

/** rosters record. */
export interface NflverseRoster {
  player_id: string;
  full_name: string;
  birth_date: string | null;
  years_exp: number | null;
  position: string | null;
  team: string | null;
  status: string | null;
  depth_chart_position: string | null;
  depth_chart_order: number | null;
  season: number;
}

interface AssetEnvelope<T> {
  generatedAt: string;
  players: T[];
}

@Injectable({ providedIn: "root" })
export class NflverseService {
  private readonly http = inject(HttpClient);

  private load<T>(path: string): Observable<Map<string, T>> {
    return this.http.get<AssetEnvelope<T>>(`assets/nflverse/${path}`).pipe(
      map((envelope) => {
        const m = new Map<string, T>();
        for (const p of envelope.players) {
          m.set((p as Record<string, unknown>)["player_id"] as string, p);
        }
        return m;
      }),
      catchError(() => of(new Map<string, T>())),
      shareReplay(1),
    );
  }

  readonly playerStats$: Observable<Map<string, NflversePlayerStats>> =
    this.load<NflversePlayerStats>("player-stats.json");

  readonly pfrAdvStats$: Observable<Map<string, NflversePfrStats>> =
    this.load<NflversePfrStats>("pfr-advstats.json");

  readonly ngsStats$: Observable<Map<string, NflverseNgsStats>> =
    this.load<NflverseNgsStats>("ngs-stats.json");

  readonly ffOpportunity$: Observable<Map<string, NflverseFfOpportunity>> =
    this.load<NflverseFfOpportunity>("ff-opportunity.json");

  readonly draftPicks$: Observable<Map<string, NflverseDraftPick>> =
    this.load<NflverseDraftPick>("draft-picks.json");

  readonly rosters$: Observable<Map<string, NflverseRoster>> =
    this.load<NflverseRoster>("rosters.json");
}
