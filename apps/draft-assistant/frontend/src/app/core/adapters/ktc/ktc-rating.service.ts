import { HttpClient } from '@angular/common/http';
import { inject, Injectable, isDevMode } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { KtcPlayer, TeamViewPlayer, TeamViewRating } from '../../models';

/**
 * Dev only – proxied to keeptradecut.com by proxy.conf.json.
 * Not usable in production (GitHub Pages has no server-side proxy).
 */
const KTC_PROXY_URL = '/ktc/dynasty-rankings';

/**
 * Pre-fetched by scripts/fetch-ktc.mjs during CI before the production build.
 * Contains the raw `playersArray` from keeptradecut.com (both oneQBValues and
 * superflexValues per player), bundled as a static asset.
 */
const KTC_STATIC_ASSET = 'assets/ktc-rankings.json';

interface KtcRawValueBlock {
  value: number;
  rank: number;
  positionalRank: number;
  overallTier: number;
  positionalTier: number;
}

interface KtcRawPlayer {
  playerName: string;
  playerID: number;
  slug: string;
  position: string;
  positionID: number;
  team: string | null;
  rookie: boolean;
  age: number | null;
  oneQBValues: KtcRawValueBlock;
  superflexValues: KtcRawValueBlock;
}

@Injectable({ providedIn: 'root' })
export class KtcRatingService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<KtcPlayer[]>>();

  /**
   * Fetch KTC dynasty rankings.
   *
   * - Development: fetches the live KTC HTML via the Angular dev-server proxy
   *   and extracts the embedded `playersArray` JavaScript variable.
   * - Production: loads a pre-fetched static JSON asset bundled at build time
   *   by `scripts/fetch-ktc.mjs`, avoiding any cross-origin request.
   */
  fetchPlayers(superflex = false): Observable<KtcPlayer[]> {
    const cacheKey = superflex ? 'superflex' : '1qb';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const obs$ = isDevMode()
      ? this.fetchFromProxy(superflex)
      : this.fetchFromStatic(superflex);

    this.cache.set(cacheKey, obs$);
    return obs$;
  }

  private fetchFromProxy(superflex: boolean): Observable<KtcPlayer[]> {
    const format = superflex ? 2 : 1;
    const url = `${KTC_PROXY_URL}?filters=QB|WR|RB|TE&format=${format}`;
    return this.http.get(url, { responseType: 'text' }).pipe(
      map((html) => this.parseHtml(html, superflex)),
      catchError(() => of([])),
      shareReplay(1),
    );
  }

  private fetchFromStatic(superflex: boolean): Observable<KtcPlayer[]> {
    return this.http.get<KtcRawPlayer[]>(KTC_STATIC_ASSET).pipe(
      map((players) => this.mapRawPlayers(players, superflex)),
      catchError(() => of([])),
      shareReplay(1),
    );
  }

  private parseHtml(html: string, superflex: boolean): KtcPlayer[] {
    const marker = 'var playersArray = ';
    const start = html.indexOf(marker);
    if (start === -1) return [];

    const arrayStart = html.indexOf('[', start);
    if (arrayStart === -1) return [];

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < html.length; i++) {
      const ch = html[i];
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }

    if (arrayEnd === -1) return [];

    try {
      const raw = JSON.parse(html.substring(arrayStart, arrayEnd + 1)) as KtcRawPlayer[];
      return this.mapRawPlayers(raw, superflex);
    } catch {
      return [];
    }
  }

  private mapRawPlayers(raw: KtcRawPlayer[], superflex: boolean): KtcPlayer[] {
    return raw.map((p) => {
      const vals = superflex ? p.superflexValues : p.oneQBValues;
      return {
        playerName: p.playerName,
        playerID: p.playerID,
        slug: p.slug,
        position: p.position,
        positionID: p.positionID,
        team: p.team,
        rookie: p.rookie,
        age: p.age,
        value: vals?.value ?? 0,
        rank: vals?.rank ?? 0,
        positionalRank: vals?.positionalRank ?? 0,
        overallTier: vals?.overallTier ?? 0,
        positionalTier: vals?.positionalTier ?? 0,
      };
    });
  }

  buildNameLookup(players: KtcPlayer[]): Map<string, KtcPlayer> {
    const lookup = new Map<string, KtcPlayer>();
    for (const player of players) {
      lookup.set(this.normalizeName(player.playerName), player);
    }
    return lookup;
  }

  normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  computeTeamRating(
    players: TeamViewPlayer[],
    ktcLookup: Map<string, KtcPlayer> | null = null,
  ): TeamViewRating {
    const positionScores: TeamViewRating['positionScores'] = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const ktcUnavailable = !ktcLookup || ktcLookup.size === 0;
    let combinedScore = 0;

    for (const player of players) {
      const score = player.ktcValue ?? 0;
      combinedScore += score;
      if (player.position === 'QB') positionScores.QB += score;
      else if (player.position === 'RB') positionScores.RB += score;
      else if (player.position === 'WR') positionScores.WR += score;
      else if (player.position === 'TE') positionScores.TE += score;
    }

    return {
      combinedScore,
      positionScores,
      playerCount: players.length,
      source: ktcUnavailable ? 'sleeper-fallback' : 'ktc',
      ktcUnavailable,
    };
  }
}
