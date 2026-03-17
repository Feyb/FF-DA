import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  League,
  LeagueRoster,
  LeagueUser,
  SleeperCatalogPlayer,
  SleeperUser,
} from '../../models';

const BASE = 'https://api.sleeper.app/v1';

@Injectable({ providedIn: 'root' })
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
}
