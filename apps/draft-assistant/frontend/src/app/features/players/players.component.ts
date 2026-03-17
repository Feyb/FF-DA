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
  template: `
    <section class="players-page">
      <header class="players-header">
        <h1 class="players-title">Players</h1>
        <p class="players-subtitle">All available players with KTC-first ordering and Sleeper fallback.</p>
      </header>

      <mat-card class="controls-card">
        <div class="controls-grid">
          <div class="position-filters">
            @for (position of positions; track position) {
              <button
                mat-stroked-button
                type="button"
                [class.filter-active]="store.selectedPositions().includes(position)"
                (click)="togglePosition(position)"
              >
                {{ position }}
              </button>
            }
          </div>

          <mat-slide-toggle
            [ngModel]="store.rookiesOnly()"
            (ngModelChange)="store.setRookiesOnly($event)"
          >
            Rookies only
          </mat-slide-toggle>

          <mat-form-field appearance="outline">
            <mat-label>Sort by</mat-label>
            <mat-select [ngModel]="store.sortBy()" (ngModelChange)="store.setSortBy($event)">
              <mat-option value="default">KTC rank (default)</mat-option>
              <mat-option value="ktcValue">KTC value</mat-option>
              <mat-option value="name">Name</mat-option>
              <mat-option value="position">Position</mat-option>
              <mat-option value="team">Team</mat-option>
              <mat-option value="age">Age</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Direction</mat-label>
            <mat-select [ngModel]="store.sortDirection()" (ngModelChange)="store.setSortDirection($event)">
              <mat-option value="asc">Ascending</mat-option>
              <mat-option value="desc">Descending</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      @if (store.ktcUnavailable()) {
        <div class="warning-banner">
          <mat-icon>warning</mat-icon>
          <span>KTC data is unavailable right now. Showing Sleeper fallback ordering.</span>
        </div>
      }

      @if (store.loading()) {
        <div class="loading-row">
          <mat-spinner diameter="36" />
          <span>Loading players...</span>
        </div>
      }

      @if (store.error()) {
        <mat-card class="error-card">
          <p>{{ store.error() }}</p>
          <button mat-flat-button type="button" (click)="retryLoad()">Retry</button>
        </mat-card>
      }

      @if (!store.loading()) {
        <mat-card class="table-card">
          <div class="table-scroll">
            <table class="players-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Age</th>
                  <th>KTC Rank</th>
                  <th>KTC Value</th>
                  <th>Tier</th>
                  <th>Pos Tier</th>
                </tr>
              </thead>
              <tbody>
                @for (player of store.displayedRows(); track player.playerId; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td>{{ player.fullName }}</td>
                    <td>{{ player.position }}</td>
                    <td>{{ player.team ?? 'FA' }}</td>
                    <td>{{ player.age ?? '-' }}</td>
                    <td>{{ player.ktcRank ?? '-' }}</td>
                    <td>{{ player.ktcValue ?? '-' }}</td>
                    <td>{{ player.overallTier ?? '-' }}</td>
                    <td>{{ player.positionalTier ?? '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (store.displayedRows().length === 0) {
            <p class="empty-copy">No players match the selected filters.</p>
          }
        </mat-card>
      }
    </section>
  `,
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
      .players-table tbody tr:hover {
        background: rgb(248 250 252);
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
  protected readonly positions = ['QB', 'RB', 'WR', 'TE'] as const;

  protected togglePosition(position: 'QB' | 'RB' | 'WR' | 'TE'): void {
    this.store.togglePosition(position);
  }

  protected retryLoad(): void {
    this.store.loadPlayers();
  }
}
