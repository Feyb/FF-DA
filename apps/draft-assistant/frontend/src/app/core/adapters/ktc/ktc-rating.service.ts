import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { KtcPlayer, TeamViewPlayer, TeamViewRating } from '../../models';

const KTC_RANKINGS_URL = '/ktc/dynasty-rankings';
const KTC_ASSET_1QB_URL = '/assets/ktc/players-1qb.json';
const KTC_ASSET_SUPERFLEX_URL = '/assets/ktc/players-superflex.json';

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

  /** Fetch KTC dynasty rankings page and extract the embedded playersArray. */
  fetchPlayers(superflex = false): Observable<KtcPlayer[]> {
    const format = superflex ? 2 : 1;
    const cacheKey = String(format);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const assetUrl = superflex ? KTC_ASSET_SUPERFLEX_URL : KTC_ASSET_1QB_URL;
    const url = `${KTC_RANKINGS_URL}?filters=QB|WR|RB|TE&format=${format}`;
    const obs$ = this.http.get<KtcPlayer[]>(assetUrl).pipe(
      map((players) => players ?? []),
      catchError(() =>
        this.http.get(url, { responseType: 'text' }).pipe(
          map((html) => this.extractPlayersArray(html, superflex)),
          catchError(() => of([])),
        ),
      ),
      shareReplay(1),
    );

    this.cache.set(cacheKey, obs$);
    return obs$;
  }

  private extractPlayersArray(html: string, superflex: boolean): KtcPlayer[] {
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
    } catch {
      return [];
    }
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
