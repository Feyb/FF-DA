import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { extractSleeperDraftId } from '../../core/adapters/sleeper/sleeper-draft.util';
import { DraftPlayerRow, DraftRecommendation, SleeperDraft } from '../../core/models';
import { AppStore } from '../../core/state/app.store';
import { DraftStore, DraftPositionFilter } from './draft.store';

interface RecommendationPositionGroup {
  position: DraftPositionFilter;
  recommendations: DraftRecommendation[];
}

interface RecommendationTierGroup {
  tier: number | null;
  positions: RecommendationPositionGroup[];
}

@Component({
  selector: 'app-draft',
  templateUrl: './draft.component.html',
  styleUrl: './draft.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DraftStore],
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
})
export class DraftComponent {
  protected readonly store = inject(DraftStore);
  protected readonly appStore = inject(AppStore);
  protected readonly positions: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];
  protected mockDraftUrl = '';
  protected mockDraftUrlError: string | null = null;
  protected readonly playerFallbackImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2240%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2214%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M18 66c3-12 13-19 22-19s19 7 22 19%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';
  protected readonly recommendationPositionOrder: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];

  protected onDraftChange(event: MatSelectChange): void {
    const draftId = String(event.value ?? '');
    if (!draftId) {
      return;
    }

    void this.store.selectDraft(draftId, { source: this.store.draftSource() ?? 'league' });
  }

  protected togglePosition(position: DraftPositionFilter): void {
    this.store.togglePosition(position);
  }

  protected refreshDraft(): void {
    void this.store.refreshNow();
  }

  protected retryLoad(): void {
    this.store.retry();
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
    if (!img || img.src === this.playerFallbackImage) {
      return;
    }

    img.src = this.playerFallbackImage;
  }

  protected ownerNameForRoster(rosterId: number | null | undefined): string {
    if (!rosterId) {
      return 'Unknown roster';
    }

    return this.store.rosterDisplayNames()[String(rosterId)] ?? `Roster ${rosterId}`;
  }

  protected draftTypeLabel(draft: SleeperDraft): string {
    const type = draft.type?.trim();
    if (type && type.length > 0) {
      return type;
    }

    const metadataName = draft.metadata?.['name'];
    if (metadataName && metadataName.trim().length > 0) {
      return metadataName;
    }

    return 'Unknown';
  }

  protected draftSetting(draft: SleeperDraft, key: string): string {
    const raw = draft.settings?.[key];
    if (raw === undefined || raw === null || raw === '') {
      return '-';
    }

    return String(raw);
  }

  protected loadMockDraftUrl(): void {
    const value = this.mockDraftUrl.trim();
    if (!value) {
      this.mockDraftUrlError = 'Enter a Sleeper draft URL or draft id.';
      return;
    }

    const draftId = extractSleeperDraftId(value);
    if (!draftId) {
      this.mockDraftUrlError = 'Could not parse draft id. Use a URL like sleeper.com/draft/nfl/<id>.';
      return;
    }

    this.mockDraftUrlError = null;
    const rookieHint = /rookie/i.test(value);
    void this.store.selectDraft(draftId, { rookieHint, source: 'direct' });
  }

  protected tierBand(tier: number | null): 's' | 'a' | 'b' | 'c' | 'd' | 'none' {
    if (tier === null) {
      return 'none';
    }

    if (tier <= 2) {
      return 's';
    }
    if (tier <= 4) {
      return 'a';
    }
    if (tier <= 6) {
      return 'b';
    }
    if (tier <= 8) {
      return 'c';
    }

    return 'd';
  }

  protected shouldShowTierDivider(rows: DraftPlayerRow[], index: number): boolean {
    if (index === 0) {
      return true;
    }

    const currentTier = rows[index]?.positionalTier ?? rows[index]?.overallTier ?? null;
    const previousTier = rows[index - 1]?.positionalTier ?? rows[index - 1]?.overallTier ?? null;
    return currentTier !== previousTier;
  }

  protected tierDividerLabel(row: DraftPlayerRow): string {
    const tier = row.positionalTier ?? row.overallTier;
    if (tier === null) {
      return 'Un-tiered';
    }

    return `Tier ${tier}`;
  }

  protected recommendationTierGroups(recommendations: DraftRecommendation[]): RecommendationTierGroup[] {
    const tierMap = new Map<number, DraftRecommendation[]>();
    const untiered: DraftRecommendation[] = [];

    for (const recommendation of recommendations) {
      const tier = recommendation.positionalTier ?? recommendation.overallTier;
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
        positions: this.recommendationPositionGroups(rows),
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
    if (group.tier === null) {
      return 'Un-tiered';
    }

    return `Tier ${group.tier}`;
  }

  private recommendationPositionGroups(recommendations: DraftRecommendation[]): RecommendationPositionGroup[] {
    return this.recommendationPositionOrder
      .map<RecommendationPositionGroup>((position) => ({
        position,
        recommendations: recommendations.filter((recommendation) => recommendation.position === position),
      }))
      .filter((group) => group.recommendations.length > 0);
  }
}
