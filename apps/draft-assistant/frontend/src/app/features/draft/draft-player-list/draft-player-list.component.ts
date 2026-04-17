import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DraftPlayerRow } from '../../../core/models';
import { PLAYER_FALLBACK_IMAGE } from '../../../core/constants/images.constants';
import {
  DraftPlayerDisplayRow,
  DraftStore,
  positionalRankForSortSource,
  rankForSortSource,
} from '../draft.store';
import { adpDeltaClass, adpDeltaLabel, sortSourceRankLabel } from '../draft-display.util';
import { TierColorPipe } from '../../../shared/pipes';

@Component({
  selector: 'app-draft-player-list',
  templateUrl: './draft-player-list.component.html',
  styleUrl: './draft-player-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TierColorPipe,
  ],
})
export class DraftPlayerListComponent {
  protected readonly store = inject(DraftStore);
  protected static readonly MAX_VISIBLE_PLAYERS = 120;
  protected readonly playerFallbackImage = PLAYER_FALLBACK_IMAGE;

  protected readonly visiblePlayerRows = computed(() =>
    this.store.allPlayerRows().slice(0, DraftPlayerListComponent.MAX_VISIBLE_PLAYERS),
  );
  protected readonly visibleUndraftedRows = computed(() =>
    this.visiblePlayerRows().filter((r) => !r.isDrafted),
  );
  protected readonly undraftedIndexMap = computed(() => {
    const map = new Map<string, number>();
    this.visibleUndraftedRows().forEach((r, i) => map.set(r.playerId, i));
    return map;
  });
  protected readonly userNextPickNumber = computed(() => this.store.userNextPickNumber());

  protected rowCombinedTier(row: DraftPlayerRow): number | null {
    return row.combinedTier;
  }

  protected rowRank(row: DraftPlayerRow): number | null {
    return rankForSortSource(row, this.store.sortSource());
  }

  protected rowPositionalRank(row: DraftPlayerRow): number | null {
    return positionalRankForSortSource(row, this.store.sortSource());
  }

  protected sortSourceRankLabel(): string {
    return sortSourceRankLabel(this.store.sortSource());
  }

  protected adpDeltaLabel(delta: number | null): string {
    return adpDeltaLabel(delta);
  }

  protected adpDeltaClass(delta: number | null): string {
    return adpDeltaClass(delta);
  }

  protected valueGapClass(gap: number | null): string {
    if (gap === null) return 'vg-none';
    if (gap === 0) return 'vg-consensus';
    if (gap === 1) return 'vg-minor';
    return 'vg-high';
  }

  protected valueGapTooltip(row: DraftPlayerRow): string {
    const ktcTier = row.overallTier;
    const flockTier = row.flockAverageTier;
    if (ktcTier === null && flockTier === null) return 'No tier data';
    const parts: string[] = [];
    if (ktcTier !== null) parts.push(`KTC: Tier ${ktcTier}`);
    if (flockTier !== null) parts.push(`Flock: Tier ${flockTier}`);
    return parts.join(' · ');
  }

  protected shouldShowTierDivider(undraftedRows: DraftPlayerDisplayRow[], undraftedIndex: number): boolean {
    if (undraftedIndex === 0) return true;
    const currentTier = undraftedRows[undraftedIndex] ? this.rowCombinedTier(undraftedRows[undraftedIndex]) : null;
    const previousTier = undraftedRows[undraftedIndex - 1] ? this.rowCombinedTier(undraftedRows[undraftedIndex - 1]) : null;
    return currentTier !== previousTier;
  }

  protected shouldShowNextPickDivider(undraftedRows: DraftPlayerDisplayRow[], undraftedIndex: number): boolean {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick || undraftedIndex === 0) return false;
    const pickedCount = this.store.picks().length;
    const picksBetweenNowAndUserPick = userNextPick - pickedCount - 1;
    return undraftedIndex === picksBetweenNowAndUserPick;
  }

  protected nextPickDividerLabel(): string {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick) return 'Your next pick';

    const draft = this.store.selectedDraft();
    if (!draft?.settings?.['teams']) return `Your next pick (#${userNextPick})`;

    const teams = draft.settings['teams'] as number;
    const round = Math.floor((userNextPick - 1) / teams) + 1;
    const pickInRound = ((userNextPick - 1) % teams) + 1;
    return `Your next pick (#${userNextPick} • R${round}.${String(pickInRound).padStart(String(teams).length, '0')})`;
  }

  protected tierDividerLabel(row: DraftPlayerRow): string {
    const tier = this.rowCombinedTier(row);
    return tier === null ? 'Un-tiered' : `Tier ${tier}`;
  }

  protected toggleStar(playerId: string): void {
    this.store.toggleStar(playerId);
  }

  protected isStarred(playerId: string): boolean {
    return this.store.starredPlayerIds().includes(playerId);
  }

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onPlayerImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.playerFallbackImage) return;
    img.src = this.playerFallbackImage;
  }

  protected toggleNeededPositionsOnly(): void {
    this.store.toggleNeededPositionsOnly();
  }
}
