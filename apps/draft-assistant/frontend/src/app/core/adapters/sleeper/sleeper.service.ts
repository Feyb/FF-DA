import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import {
  League,
  SleeperDraft,
  SleeperDraftPick,
  LeagueRoster,
  LeagueUser,
  SleeperCatalogPlayer,
  SleeperUser,
} from "../../models";

const BASE = "https://api.sleeper.app/v1";

@Injectable({ providedIn: "root" })
export class SleeperService {
  private readonly http = inject(HttpClient);

  getUserByUsername(username: string): Observable<SleeperUser> {
    return this.http.get<SleeperUser>(`${BASE}/user/${username}`);
  }

  getLeaguesByUserId(userId: string, season: string): Observable<League[]> {
    return this.http.get<League[]>(`${BASE}/user/${userId}/leagues/nfl/${season}`);
  }

  getLeagueById(leagueId: string): Observable<League> {
    return this.http.get<League>(`${BASE}/league/${leagueId}`);
  }

  getLeagueRosters(leagueId: string): Observable<LeagueRoster[]> {
    return this.http.get<LeagueRoster[]>(`${BASE}/league/${leagueId}/rosters`);
  }

  getLeagueUsers(leagueId: string): Observable<LeagueUser[]> {
    return this.http.get<LeagueUser[]>(`${BASE}/league/${leagueId}/users`);
  }

  getAllPlayers(): Observable<Record<string, SleeperCatalogPlayer>> {
    return this.http.get<Record<string, SleeperCatalogPlayer>>(`${BASE}/players/nfl`);
  }

  getLeagueDrafts(leagueId: string): Observable<SleeperDraft[]> {
    return this.http.get<SleeperDraft[]>(`${BASE}/league/${leagueId}/drafts`);
  }

  getDraft(draftId: string): Observable<SleeperDraft> {
    return this.http.get<SleeperDraft>(`${BASE}/draft/${draftId}`);
  }

  getDraftPicks(draftId: string): Observable<SleeperDraftPick[]> {
    return this.http.get<SleeperDraftPick[]>(`${BASE}/draft/${draftId}/picks`);
  }

  getTrendingPlayers(
    type: "add" | "drop" = "add",
    limit = 100,
  ): Observable<{ player_id: string; count: number }[]> {
    return this.http.get<{ player_id: string; count: number }[]>(
      `${BASE}/players/nfl/trending/${type}?limit=${limit}`,
    );
  }
}
