import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  BestAvailableEntry,
  DraftPositionFilter,
  DraftStore,
  rankForSortSource,
} from '../draft.store';
import { DraftRecommendation } from '../../../core/models';
import { TierLegendComponent } from '../../../shared/components/tier-legend';
import { resolveTier } from '../../../core/utils/tier-resolution.util';

interface RecommendationPositionGroup {
  position: DraftPositionFilter;
  recommendations: DraftRecommendation[];
}

interface RecommendationTierGroup {
  tier: number | null;
  positions: RecommendationPositionGroup[];
}

@Component({
  selector: 'app-best-available-card',
  templateUrl: './best-available-card.component.html',
  styleUrl: './best-available-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule, MatIconModule, TierLegendComponent],
})
export class BestAvailableCardComponent {
  protected readonly store = inject(DraftStore);
  protected readonly recommendationPositionOrder: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];

  protected tierColorClass(tier: number | null): string {
    if (tier === null) return 'tier-unranked';
    const tierNum = Math.max(1, Math.min(tier, 10));
    const cycledTier = ((tierNum - 1) % 10) + 1;
    return `tier-${cycledTier}`;
  }

  protected adpDeltaLabel(delta: number | null): string {
    if (delta === null) return '—';
    if (delta > 0) return `+${delta}`;
    return String(delta);
  }

  protected adpDeltaClass(delta: number | null): string {
    if (delta === null) return '';
    if (delta > 1) return 'adp-value';
    if (delta < -1) return 'adp-reach';
    return 'adp-neutral';
  }

  protected sortSourceRankLabel(): string {
    switch (this.store.sortSource()) {
      case 'combinedTier': return 'Comb. Tier';
      case 'sleeperRank': return 'Sleeper Rank';
      case 'ktcRank': return 'KTC Rank';
      case 'flockRank': return 'Flock Rank';
      case 'combinedPositionalTier': return 'Comb. Pos. Tier';
      case 'adpDelta': return 'ADP Delta';
      case 'valueGap': return 'Value Gap';
    }
  }

  protected bestAvailableRank(entry: BestAvailableEntry): number | null {
    return entry.player ? rankForSortSource(entry.player, this.store.sortSource()) : null;
  }

  protected recTier(rec: DraftRecommendation): number | null {
    return this.resolveTier(
      rec.overallTier,
      rec.positionalTier,
      rec.flockAverageTier,
      rec.flockAveragePositionalTier,
    );
  }

  protected recommendationTierGroups(recommendations: DraftRecommendation[]): RecommendationTierGroup[] {
    const tierMap = new Map<number, DraftRecommendation[]>();
    const untiered: DraftRecommendation[] = [];

    for (const recommendation of recommendations) {
      const tier = this.recTier(recommendation);
      if (tier === null) {
        untiered.push(recommendation);
        continue;
      }
      const existing = tierMap.get(tier) ?? [];
      existing.push(recommendation);
      tierMap.set(tier, existing);
    }

    const tierGroups = [...tierMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map<RecommendationTierGroup>(([tier, rows]) => ({
        tier,
        positions: this.recommendationPositionGroups(rows.slice(0, 3)),
      }));

    if (untiered.length > 0) {
      tierGroups.push({
        tier: null,
        positions: this.recommendationPositionGroups(untiered),
      });
    }

    return tierGroups;
  }

  protected tierGroupLabel(group: RecommendationTierGroup): string {
    return group.tier === null ? 'Un-tiered' : `Tier ${group.tier}`;
  }

  private resolveTier(
    ktcOverall: number | null,
    ktcPositional: number | null,
    flockOverall: number | null,
    flockPositional: number | null,
  ): number | null {
    return resolveTier(ktcPositional ?? ktcOverall, flockPositional ?? flockOverall, this.store.tierSource());
  }

  private recommendationPositionGroups(recommendations: DraftRecommendation[]): RecommendationPositionGroup[] {
    return this.recommendationPositionOrder
      .map<RecommendationPositionGroup>((position) => ({
        position,
        recommendations: recommendations.filter((r) => r.position === position),
      }))
      .filter((group) => group.recommendations.length > 0);
  }
}
