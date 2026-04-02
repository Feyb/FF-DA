import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { FlockPlayer } from '../../models';

const FLOCK_ASSET_1QB_URL = 'assets/flock/players-1qb.json';
const FLOCK_ASSET_SUPERFLEX_URL = 'assets/flock/players-superflex.json';
const FLOCK_ASSET_ROOKIES_1QB_URL = 'assets/flock/players-rookies-1qb.json';
const FLOCK_ASSET_ROOKIES_SF_URL = 'assets/flock/players-rookies-sf.json';

interface FlockAssetPlayer {
  playerName?: string;
  position?: string;
  team?: string | null;
  averageRank?: number | null;
  averageTier?: number | null;
  averagePositionalTier?: number | null;
}

interface FlockAssetResponse {
  data?: FlockAssetPlayer[];
}

@Injectable({ providedIn: 'root' })
export class FlockRatingService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<FlockPlayer[]>>();

  fetchPlayers(superflex = false): Observable<FlockPlayer[]> {
    const cacheKey = superflex ? 'superflex' : '1qb';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const assetUrl = superflex ? FLOCK_ASSET_SUPERFLEX_URL : FLOCK_ASSET_1QB_URL;
    const obs$ = this.http.get<FlockAssetResponse>(assetUrl).pipe(
      map((response) =>
        (response.data ?? []).map((player) => ({
          playerName: (player.playerName ?? '').trim(),
          position: player.position ?? '',
          team: player.team ?? null,
          averageRank: player.averageRank ?? null,
          averageTier: player.averageTier ?? null,
          averagePositionalTier: player.averagePositionalTier ?? null,
        })),
      ),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(cacheKey, obs$);
    return obs$;
  }

  fetchRookies(superflex = false): Observable<FlockPlayer[]> {
    const cacheKey = superflex ? 'rookies-sf' : 'rookies-1qb';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const assetUrl = superflex ? FLOCK_ASSET_ROOKIES_SF_URL : FLOCK_ASSET_ROOKIES_1QB_URL;
    const obs$ = this.http.get<FlockAssetResponse>(assetUrl).pipe(
      map((response) =>
        (response.data ?? []).map((player) => ({
          playerName: (player.playerName ?? '').trim(),
          position: player.position ?? '',
          team: player.team ?? null,
          averageRank: player.averageRank ?? null,
          averageTier: player.averageTier ?? null,
          averagePositionalTier: player.averagePositionalTier ?? null,
        })),
      ),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(cacheKey, obs$);
    return obs$;
  }

  buildNameLookup(players: FlockPlayer[]): Map<string, FlockPlayer> {
    return new Map(players.map((player) => [this.normalizeName(player.playerName), player]));
  }

  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
