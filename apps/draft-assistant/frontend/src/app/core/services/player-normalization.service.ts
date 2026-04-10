import { Injectable, inject } from '@angular/core';
import { KtcRatingService } from '../adapters/ktc/ktc-rating.service';
import { FlockRatingService } from '../adapters/flock/flock-rating.service';
import { DraftPlayerRow, FlockPlayer, KtcPlayer, SleeperCatalogPlayer } from '../models';
import { buildFullName } from '../utils/player-name.util';

type ActivePositions = readonly ('QB' | 'RB' | 'WR' | 'TE')[];
const DEFAULT_ACTIVE_POSITIONS: ActivePositions = ['QB', 'RB', 'WR', 'TE'];

/**
 * Centralised service that maps Sleeper catalog players to the shared
 * `DraftPlayerRow` shape, computing KTC / Flock lookups, sleeperRank, and
 * applying active-player / position filters.
 *
 * Used by DraftStore and PlayersStore to eliminate ~150 lines of duplicated
 * normalisation logic.
 */
@Injectable({ providedIn: 'root' })
export class PlayerNormalizationService {
  private readonly ktcService = inject(KtcRatingService);
  private readonly flockService = inject(FlockRatingService);

  isActivePlayer(source: SleeperCatalogPlayer): boolean {
    if (source.active === false) return false;
    const status = source.status?.toLowerCase().trim();
    if (!status) return true;
    return status === 'active';
  }

  normalizePlayer(
    playerId: string,
    source: SleeperCatalogPlayer,
    ktcLookup: Map<string, KtcPlayer>,
    flockLookup: Map<string, FlockPlayer>,
    currentSeason: number,
  ): Omit<DraftPlayerRow, 'sleeperRank' | 'adpDelta'> {
    const firstName = source.first_name ?? '';
    const lastName = source.last_name ?? '';
    const fullName = source.full_name?.trim() || buildFullName(firstName, lastName);
    const position = (source.position ?? '') as DraftPlayerRow['position'];

    const ktcPlayer = ktcLookup.get(this.ktcService.normalizeName(fullName));
    const flockPlayer = flockLookup.get(this.flockService.normalizeName(fullName));

    const ktcOverallTier = ktcPlayer?.overallTier ?? null;
    const ktcPositionalTier = ktcPlayer?.positionalTier ?? null;
    const ktcPositionalRank = ktcPlayer?.positionalRank ?? null;
    const flockTier = flockPlayer?.averageTier ?? null;
    const flockPositionalTier = flockPlayer?.averagePositionalTier ?? null;
    const flockPositionalRank = flockPlayer?.averagePositionalRank ?? null;
    const flockAverageRank = flockPlayer?.averageRank ?? null;

    // SRS §3.1: combinedTier = sum of all available source tiers (lower = better).
    // When only one source has data the missing source contributes 0 to the sum, so
    // single-source players will sort ahead of dual-source players with the same
    // individual tier.  This is intentional: a player recognised by at least one
    // high-quality source is still considered preferable to an unranked player.
    const combinedTier =
      ktcOverallTier !== null || flockTier !== null
        ? (ktcOverallTier ?? 0) + (flockTier ?? 0)
        : null;

    const combinedPositionalTier =
      ktcPositionalTier !== null || flockPositionalTier !== null
        ? (ktcPositionalTier ?? 0) + (flockPositionalTier ?? 0)
        : null;

    // ADP: use flockAverageRank as proxy for Sleeper ADP (REQ-DS-05 / REQ-ADP-01).
    const adpRank = flockAverageRank;

    // valueGap = |ktcOverallTier – flockAverageTier| (REQ-VG-01).
    let valueGap: number | null = null;
    if (ktcOverallTier !== null && flockTier !== null) {
      valueGap = Math.abs(ktcOverallTier - flockTier);
    }

    return {
      playerId,
      fullName,
      position,
      team: source.team ?? null,
      age: source.age ?? null,
      rookie: ktcPlayer?.rookie ?? source.rookie_year === currentSeason,
      ktcValue: ktcPlayer?.value ?? null,
      ktcRank: ktcPlayer?.rank ?? null,
      ktcPositionalRank,
      overallTier: ktcOverallTier,
      positionalTier: ktcPositionalTier,
      flockAverageTier: flockTier,
      flockAveragePositionalTier: flockPositionalTier,
      flockAveragePositionalRank: flockPositionalRank,
      averageRank: flockAverageRank,
      combinedTier,
      combinedPositionalTier,
      adpRank,
      valueGap,
    };
  }

  /**
   * Build a full `DraftPlayerRow[]` from the Sleeper player catalog, applying
   * active-player / position filters and computing `sleeperRank` via KTC rank.
   * Also computes `adpDelta` after sleeperRank is assigned (REQ-ADP-02).
   */
  buildPlayerRows(
    playersById: Record<string, SleeperCatalogPlayer>,
    ktcLookup: Map<string, KtcPlayer>,
    flockLookup: Map<string, FlockPlayer>,
    currentSeason: number,
    positions: ActivePositions = DEFAULT_ACTIVE_POSITIONS,
  ): DraftPlayerRow[] {
    const positionSet = new Set<string>(positions);

    const rawRows = Object.entries(playersById)
      .filter(([, source]) => this.isActivePlayer(source))
      .map(([playerId, source]) =>
        this.normalizePlayer(playerId, source, ktcLookup, flockLookup, currentSeason),
      )
      .filter((row) => row.fullName.length > 0)
      .filter((row) => positionSet.has(row.position))
      .filter((row) => row.team !== null || row.rookie);

    const sorted = [...rawRows].sort(
      (a, b) => (a.ktcRank ?? Number.MAX_SAFE_INTEGER) - (b.ktcRank ?? Number.MAX_SAFE_INTEGER),
    );
    const rankMap = new Map(sorted.map((row, i) => [row.playerId, i + 1]));

    return rawRows.map((row) => {
      const sleeperRank = rankMap.get(row.playerId) ?? Number.MAX_SAFE_INTEGER;

      // REQ-ADP-02: adpDelta = adpRank – (sleeperRank + ktcRank + flockAverageRank) / 3
      let adpDelta: number | null = null;
      if (row.adpRank !== null && row.ktcRank !== null) {
        const combinedAvgRank = (sleeperRank + row.ktcRank + (row.averageRank ?? row.ktcRank)) / 3;
        adpDelta = Math.round((row.adpRank - combinedAvgRank) * 10) / 10;
      }

      return { ...row, sleeperRank, adpDelta };
    });
  }
}
