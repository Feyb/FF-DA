import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  PlayerRow,
  PlayersStore,
  PositionFilter,
  SortBy,
  SortDirection,
} from './players.store';

interface PlayersStoreView {
  selectedPositions: () => PositionFilter[];
  rookiesOnly: () => boolean;
  sortBy: () => SortBy;
  sortDirection: () => SortDirection;
  ktcUnavailable: () => boolean;
  loading: () => boolean;
  error: () => string | null;
  displayedRows: () => PlayerRow[];
  setRookiesOnly: (value: boolean) => void;
  setSortBy: (value: SortBy) => void;
  setSortDirection: (value: SortDirection) => void;
  togglePosition: (position: PositionFilter) => void;
  loadPlayers: () => Promise<void>;
}

@Component({
  selector: 'app-players',
  templateUrl: './players.component.html',
  styles: [
    `
      .players-page {
        max-width: 72rem;
        margin: 0 auto;
        padding: 2rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .players-header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .players-title {
        font-size: 1.875rem;
        line-height: 2.25rem;
        font-weight: 700;
      }
      .players-subtitle {
        font-size: 0.875rem;
        color: rgb(71 85 105);
      }
      .controls-card {
        padding: 1rem;
      }
      .controls-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(1, minmax(0, 1fr));
      }
      @media (min-width: 768px) {
        .controls-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1280px) {
        .controls-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
      .position-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .filter-active {
        background: #0f172a;
        color: #fff;
      }
      .warning-banner {
        border: 1px solid rgb(252 211 77);
        background: rgb(255 251 235);
        color: rgb(146 64 14);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
      }
      .loading-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .error-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
      }
      .table-card {
        padding: 0;
        overflow: hidden;
      }
      .table-scroll {
        overflow-x: auto;
      }
      .players-table {
        width: 100%;
        border-collapse: collapse;
      }
      .players-table th,
      .players-table td {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid rgb(226 232 240);
        font-size: 0.875rem;
      }
      .players-table thead th {
        background: rgb(248 250 252);
        font-weight: 600;
      }

      .expander-col {
        width: 2.75rem;
      }

      .expander-cell {
        width: 2.75rem;
        text-align: center;
      }

      .players-table tbody tr:hover {
        background: rgb(248 250 252);
      }

      .row-expanded {
        background: rgb(248 250 252);
      }

      .row-tier-s {
        background: rgb(236 253 245);
      }

      .row-tier-a {
        background: rgb(239 246 255);
      }

      .row-tier-b {
        background: rgb(250 245 255);
      }

      .row-tier-c {
        background: rgb(255 251 235);
      }

      .row-tier-d {
        background: rgb(248 250 252);
      }

      .player-details-row td {
        background: rgb(241 245 249);
        border-bottom: 1px solid rgb(203 213 225);
      }

      .player-details-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem 1rem;
        padding: 0.75rem 0.25rem;
      }

      @media (max-width: 768px) {
        .player-details-grid {
          grid-template-columns: 1fr;
        }
      }

      .player-detail-item {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 0.8125rem;
      }

      .detail-label {
        color: rgb(71 85 105);
      }

      .detail-value {
        font-weight: 600;
        color: rgb(15 23 42);
      }

      .player-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 12rem;
      }
      .player-avatar {
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 9999px;
        object-fit: cover;
        background: rgb(226 232 240);
        flex-shrink: 0;
      }
      .player-cell-name {
        white-space: nowrap;
      }
      .empty-copy {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        color: rgb(71 85 105);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlayersStore],
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
})
export class PlayersComponent {
  protected readonly store = inject(PlayersStore) as PlayersStoreView;
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

  protected isTier(
    tier: number | null,
    target: 's' | 'a' | 'b' | 'c' | 'd',
  ): boolean {
    if (tier === null) {
      return false;
    }

    if (target === 's') {
      return tier <= 2;
    }
    if (target === 'a') {
      return tier >= 3 && tier <= 4;
    }
    if (target === 'b') {
      return tier >= 5 && tier <= 6;
    }
    if (target === 'c') {
      return tier >= 7 && tier <= 8;
    }

    return tier >= 9;
  }
}

