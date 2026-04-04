import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TierLegendComponent } from '../../shared/components/tier-legend';
import {
  PlayerRow,
  PlayersStore,
  PositionFilter,
  SortBy,
  SortDirection,
  ValueSource,
} from './players.store';
import { TierSource } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { LoadingStateComponent } from '../../shared/components/loading-state';
import { ErrorStateComponent } from '../../shared/components/error-state';

interface PlayersStoreView {
  selectedPositions: () => PositionFilter[];
  rookiesOnly: () => boolean;
  sortBy: () => SortBy;
  sortDirection: () => SortDirection;
  tierSource: () => TierSource;
  valueSource: () => ValueSource;
  ktcUnavailable: () => boolean;
  loading: () => boolean;
  error: () => string | null;
  displayedRows: () => PlayerRow[];
  setRookiesOnly: (value: boolean) => void;
  setSortBy: (value: SortBy) => void;
  setSortDirection: (value: SortDirection) => void;
  setTierSource: (value: TierSource) => void;
  setValueSource: (value: ValueSource) => void;
  togglePosition: (position: PositionFilter) => void;
  loadPlayers: () => Promise<void>;
}

@Component({
  selector: 'app-players',
  templateUrl: './players.component.html',
  styleUrl: './players.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlayersStore],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    TierLegendComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
})
export class PlayersComponent {
  protected readonly store = inject(PlayersStore) as PlayersStoreView;
  protected readonly tierSources: Array<{ value: TierSource; label: string }> = [
    { value: 'average', label: 'Average (KTC + Flock)' },
    { value: 'flock', label: 'Flock' },
    { value: 'ktc', label: 'KTC' },
  ];
  protected readonly valueSources: Array<{ value: ValueSource; label: string }> = [
    { value: 'ktcValue', label: 'KTC Value' },
    { value: 'averageRank', label: 'Flock Average Rank' },
  ];
  protected expandedPlayerId: string | null = null;
  protected readonly playerFallbackImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2240%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2214%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M18 66c3-12 13-19 22-19s19 7 22 19%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';
  protected readonly positions = ['QB', 'RB', 'WR', 'TE'] as const;

  protected togglePosition(position: 'QB' | 'RB' | 'WR' | 'TE'): void {
    this.store.togglePosition(position);
  }

  protected retryLoad(): void {
    this.store.loadPlayers();
  }

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onPlayerImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.playerFallbackImage) {
      return;
    }
    img.src = this.playerFallbackImage;
  }

  protected toggleExpanded(playerId: string): void {
    this.expandedPlayerId = this.expandedPlayerId === playerId ? null : playerId;
  }

  protected isExpanded(playerId: string): boolean {
    return this.expandedPlayerId === playerId;
  }

  protected getTierClass(tier: number | null): string {
    if (tier === null) {
      return '';
    }
    const tierNum = Math.max(1, Math.min(tier, 10));
    return `row-tier-${tierNum}`;
  }

  protected selectedTierValue(player: PlayerRow, positional: boolean): number | null {
    return this.resolveTierValue(player, this.store.tierSource(), positional);
  }

  protected secondaryTierText(player: PlayerRow, positional: boolean): string {
    const source = this.store.tierSource();
    if (source === 'average') {
      return `Flock: ${this.formatTier(this.resolveTierValue(player, 'flock', positional))}, KTC: ${this.formatTier(this.resolveTierValue(player, 'ktc', positional))}`;
    }

    if (source === 'flock') {
      return `KTC: ${this.formatTier(this.resolveTierValue(player, 'ktc', positional))}, Avg: ${this.formatTier(this.resolveTierValue(player, 'average', positional))}`;
    }

    return `Flock: ${this.formatTier(this.resolveTierValue(player, 'flock', positional))}, Avg: ${this.formatTier(this.resolveTierValue(player, 'average', positional))}`;
  }

  protected selectedValue(player: PlayerRow): number | null {
    const source = this.store.valueSource();
    return source === 'ktcValue' ? player.ktcValue : player.averageRank;
  }

  protected selectedValueLabel(): string {
    return this.store.valueSource() === 'ktcValue' ? 'KTC Value' : 'Flock Average Rank';
  }

  private resolveTierValue(player: PlayerRow, source: TierSource, positional: boolean): number | null {
    const ktcTier = positional ? player.positionalTier : player.overallTier;
    const flockTier = positional ? player.flockAveragePositionalTier : player.flockAverageTier;

    if (source === 'ktc') {
      return ktcTier;
    }

    if (source === 'flock') {
      return flockTier ?? ktcTier;
    }

    if (flockTier === null) {
      return ktcTier;
    }

    if (ktcTier === null) {
      return flockTier;
    }

    return Math.round((ktcTier + flockTier) / 2);
  }

  private formatTier(value: number | null): string {
    return value === null ? '-' : String(value);
  }
}

