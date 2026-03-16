import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { League, SleeperUser } from '../../models';

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
}
