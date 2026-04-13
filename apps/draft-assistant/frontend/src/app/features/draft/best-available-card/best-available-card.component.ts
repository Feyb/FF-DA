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
import { TierLegendComponent } from '../../../shared/components/tier-legend';
import { TierColorPipe } from '../../../shared/pipes';

@Component({
  selector: 'app-best-available-card',
  templateUrl: './best-available-card.component.html',
  styleUrl: './best-available-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule, MatIconModule, TierLegendComponent, TierColorPipe],
})
export class BestAvailableCardComponent {
  protected readonly store = inject(DraftStore);

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
}
