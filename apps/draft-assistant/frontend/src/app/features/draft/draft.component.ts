import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  extractSleeperDraftId,
  getSleeperDraftNameLabel,
  getSleeperDraftPresentation,
  getSleeperDraftScoringLabel,
  getSleeperDraftStatusLabel,
  getSleeperDraftTypeLabel,
  getSleeperUserDraftPosition,
} from '../../core/adapters/sleeper/sleeper-draft.util';
import { DraftPlayerRow, DraftRecommendation, SleeperDraft } from '../../core/models';
import { AppStore } from '../../core/state/app.store';
import { DraftStore, DraftPositionFilter, DraftSourceMode, DraftValueSource } from './draft.store';
import { TierLegendComponent } from '../../shared/components/tier-legend';
import { DraftBoardGridComponent } from './draft-board-grid/draft-board-grid.component';
import { TierSource } from '../../core/models';
import { PLAYER_FALLBACK_IMAGE } from '../../core/constants/images.constants';
import { resolveTier } from '../../core/utils/tier-resolution.util';

interface RecommendationPositionGroup {
  position: DraftPositionFilter;
  recommendations: DraftRecommendation[];
}

interface RecommendationTierGroup {
  tier: number | null;
  positions: RecommendationPositionGroup[];
}

interface DraftOptionView {
  draft: SleeperDraft;
  draftId: string;
  title: string;
  subtitle: string;
  meta: string[];
}

interface SavedDirectUrlView {
  draftId: string;
  title: string;
  subtitle: string;
  meta: string[];
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
    MatButtonToggleModule,
    MatSelectModule,
    MatSlideToggleModule,
    TierLegendComponent,
    DraftBoardGridComponent,
  ],
})
export class DraftComponent implements OnInit {
  protected readonly store = inject(DraftStore);
  protected readonly appStore = inject(AppStore);
  protected readonly positions: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];
  protected mockDraftUrl = '';
  protected mockDraftUrlError: string | null = null;
  protected readonly playerFallbackImage = PLAYER_FALLBACK_IMAGE;
  protected readonly recommendationPositionOrder: DraftPositionFilter[] = ['QB', 'RB', 'WR', 'TE'];
  protected readonly savedDirectUrls = signal<Array<{ url: string; draftId: string }>>([]);
  protected readonly directUrlStorageKey = 'draft-assistant:direct-urls';
  protected readonly sourceModes: DraftSourceMode[] = ['league', 'direct'];
  protected readonly activeSourceMode = computed<DraftSourceMode>(() => this.store.draftSource() ?? 'league');
  protected readonly tierSources: Array<{ value: TierSource; label: string }> = [
    { value: 'average', label: 'Average (KTC + Flock)' },
    { value: 'flock', label: 'Flock' },
    { value: 'ktc', label: 'KTC' },
  ];
  protected readonly valueSources: Array<{ value: DraftValueSource; label: string }> = [
    { value: 'ktcValue', label: 'KTC Value' },
    { value: 'averageRank', label: 'Flock Average Rank' },
  ];
  protected readonly sourceLabel = computed(() =>
    this.activeSourceMode() === 'direct' ? 'Direct URL' : 'League Draft',
  );
  protected readonly savedDirectDraftIds = computed(() =>
    new Set(this.savedDirectUrls().map((item) => item.draftId)),
  );
  protected readonly leagueDraftOptions = computed(() =>
    this.store
      .drafts()
      .filter((draft) => !this.savedDirectDraftIds().has(draft.draft_id))
      .map((draft) => this.buildLeagueDraftOption(draft)),
  );
  protected readonly savedDirectUrlOptions = computed(() =>
    this.savedDirectUrls().map((item) => this.buildSavedDirectUrlOption(item)),
  );
  protected readonly userNextPickNumber = computed(() => {
    const userId = this.appStore.user()?.user_id;
    const draft = this.store.selectedDraft();
    if (!userId || !draft) {
      return null;
    }

    const userSlot = draft.draft_order?.[userId];
    if (!userSlot || typeof userSlot !== 'number' || userSlot <= 0) {
      return null;
    }

    const teams = draft.settings?.['teams'];
    if (!teams || typeof teams !== 'number' || teams <= 0) {
      return null;
    }

    const nextPickNum = this.store.nextPickNumber();
    const currentRound = Math.floor((nextPickNum - 1) / teams);
    const pickInRound = ((nextPickNum - 1) % teams) + 1;

    let userPickInRound: number;
    if (currentRound % 2 === 0) {
      userPickInRound = userSlot;
    } else {
      userPickInRound = teams - userSlot + 1;
    }

    if (pickInRound < userPickInRound) {
      return currentRound * teams + userPickInRound;
    }

    const nextRound = currentRound + 1;
    let nextRoundUserPickInRound: number;
    if (nextRound % 2 === 0) {
      nextRoundUserPickInRound = userSlot;
    } else {
      nextRoundUserPickInRound = teams - userSlot + 1;
    }

    return nextRound * teams + nextRoundUserPickInRound;
  });

  ngOnInit(): void {
    this.loadSavedDirectUrls();
  }

  protected onDraftChange(event: MatSelectChange): void {
    const draftId = String(event.value ?? '');
    if (!draftId) {
      return;
    }

    void this.store.selectDraft(draftId, { source: this.activeSourceMode() });
  }

  protected onSourceModeChange(mode: DraftSourceMode): void {
    this.mockDraftUrlError = null;
    if (this.activeSourceMode() === mode) {
      return;
    }

    this.store.setDraftSource(mode);

    if (mode === 'league') {
      if (!this.appStore.selectedLeague()) {
        return;
      }

      const [firstLeagueDraft] = this.leagueDraftOptions();
      if (firstLeagueDraft) {
        void this.store.selectDraft(firstLeagueDraft.draftId, { source: 'league' });
      } else {
        void this.store.loadForSelectedLeague();
      }
      return;
    }

    const [firstDirectDraft] = this.savedDirectUrlOptions();
    if (firstDirectDraft) {
      void this.store.selectDraft(firstDirectDraft.draftId, { source: 'direct' });
    }
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

  protected loadSavedDirectUrls(): void {
    try {
      const raw = localStorage.getItem(this.directUrlStorageKey);
      if (!raw) {
        this.savedDirectUrls.set([]);
        return;
      }
      const parsed = JSON.parse(raw) as Array<{ url: string; draftId: string }>;
      this.savedDirectUrls.set(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.savedDirectUrls.set([]);
    }
  }

  protected saveDirectUrl(url: string, draftId: string): void {
    try {
      const current = this.savedDirectUrls();
      const exists = current.some((item) => item.draftId === draftId);
      if (!exists) {
        const updated = [{ url, draftId }, ...current];
        this.savedDirectUrls.set(updated);
        localStorage.setItem(this.directUrlStorageKey, JSON.stringify(updated));
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  protected clearSavedUrls(): void {
    try {
      this.savedDirectUrls.set([]);
      localStorage.removeItem(this.directUrlStorageKey);
    } catch {
      // Silently fail if localStorage is unavailable
    }
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

  protected playerNameForId(playerId: string | null | undefined): string {
    if (!playerId) {
      return 'Unknown player';
    }

    return this.store.playerNameMap()[playerId] ?? playerId;
  }

  protected draftTypeLabel(draft: SleeperDraft): string {
    return getSleeperDraftTypeLabel(draft);
  }

  protected draftSetting(draft: SleeperDraft, key: string): string {
    const raw = draft.settings?.[key];
    if (raw === undefined || raw === null || raw === '') {
      return '-';
    }

    return String(raw);
  }

  protected draftStartLabel(draft: SleeperDraft): string {
    if (!draft.start_time) {
      return '-';
    }

    return new Date(draft.start_time).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  protected draftNameLabel(draft: SleeperDraft): string {
    return getSleeperDraftNameLabel(draft);
  }

  protected draftScoringLabel(draft: SleeperDraft): string {
    return getSleeperDraftScoringLabel(draft, this.draftLeague(draft));
  }

  protected userDraftSlotLabel(draft: SleeperDraft): string {
    const position = this.userDraftPosition(draft);
    return position === null ? '-' : String(position.slot);
  }

  protected userDraftPositionLabel(draft: SleeperDraft): string {
    return this.userDraftPosition(draft)?.label ?? '-';
  }

  protected draftStatusLabel(draft: SleeperDraft): string {
    return getSleeperDraftStatusLabel(draft);
  }

  protected draftOptionTrackBy(option: DraftOptionView | SavedDirectUrlView): string {
    return option.draftId;
  }

  protected draftOptionStatusClass(draft: SleeperDraft): string {
    const status = draft.status?.toLowerCase() ?? 'unknown';
    return `draft-option-status-${status.replace(/[^a-z0-9]+/g, '-')}`;
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
    this.saveDirectUrl(value, draftId);
    void this.store.selectDraft(draftId, { rookieHint, source: 'direct' });
  }

  protected tierColorClass(tier: number | null): string {
    if (tier === null) {
      return 'tier-unranked';
    }

    const tierNum = Math.max(1, Math.min(tier, 10));
    const cycledTier = ((tierNum - 1) % 10) + 1;
    return `tier-${cycledTier}`;
  }

  protected shouldShowTierDivider(rows: DraftPlayerRow[], index: number): boolean {
    if (index === 0) {
      return true;
    }

    const currentTier = rows[index] ? this.rowTier(rows[index]) : null;
    const previousTier = rows[index - 1] ? this.rowTier(rows[index - 1]) : null;
    return currentTier !== previousTier;
  }

  protected shouldShowNextPickDivider(rows: DraftPlayerRow[], index: number): boolean {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick || index === 0) {
      return false;
    }

    const pickedCount = this.store.picks().length;
    const picksBetweenNowAndUserPick = userNextPick - pickedCount - 1;

    if (index === picksBetweenNowAndUserPick && index > 0) {
      return true;
    }

    return false;
  }

  protected nextPickDividerLabel(): string {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick) {
      return 'Your next pick';
    }

    const draft = this.store.selectedDraft();
    if (!draft?.settings?.['teams']) {
      return `Your next pick (#${userNextPick})`;
    }

    const teams = draft.settings['teams'] as number;
    const round = Math.floor((userNextPick - 1) / teams) + 1;
    const pickInRound = ((userNextPick - 1) % teams) + 1;

    return `Your next pick (#${userNextPick} • R${round}.${String(pickInRound).padStart(String(teams).length, '0')})`;
  }

  protected tierDividerLabel(row: DraftPlayerRow): string {
    const tier = this.rowTier(row);
    if (tier === null) {
      return 'Un-tiered';
    }

    return `Tier ${tier}`;
  }

  protected recTier(rec: DraftRecommendation): number | null {
    return this.resolveTier(
      rec.overallTier,
      rec.positionalTier,
      rec.flockAverageTier,
      rec.flockAveragePositionalTier,
    );
  }

  protected rowTier(row: DraftPlayerRow): number | null {
    return this.resolveTier(
      row.overallTier,
      row.positionalTier,
      row.flockAverageTier,
      row.flockAveragePositionalTier,
    );
  }

  protected selectedValue(row: DraftPlayerRow | DraftRecommendation): number | null {
    return this.store.valueSource() === 'ktcValue' ? row.ktcValue : row.averageRank;
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
        // Defensive safeguard: cap each tier to 3 recommendations max
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
    if (group.tier === null) {
      return 'Un-tiered';
    }

    return `Tier ${group.tier}`;
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
        recommendations: recommendations.filter((recommendation) => recommendation.position === position),
      }))
      .filter((group) => group.recommendations.length > 0);
  }

  private buildLeagueDraftOption(draft: SleeperDraft): DraftOptionView {
    const presentation = getSleeperDraftPresentation(draft, this.draftLeague(draft));
    const teams = this.draftSetting(draft, 'teams');
    const rounds = this.draftSetting(draft, 'rounds');
    const userPosition = this.userDraftPosition(draft);
    const startTime = draft.start_time ? this.draftStartLabel(draft) : null;

    const meta = [presentation.scoring, `${teams} teams`, `${rounds} rounds`];
    if (userPosition !== null) {
      meta.push(`Pick ${userPosition.label}`);
    }
    if (startTime) {
      meta.push(startTime);
    }

    return {
      draft,
      draftId: draft.draft_id,
      title: presentation.name,
      subtitle: `${presentation.type} • ${presentation.status}`,
      meta,
    };
  }

  private buildSavedDirectUrlOption(item: { url: string; draftId: string }): SavedDirectUrlView {
    const loadedDraft = this.store.drafts().find((draft) => draft.draft_id === item.draftId) ?? null;
    if (loadedDraft) {
      const presentation = getSleeperDraftPresentation(loadedDraft, this.draftLeague(loadedDraft));
      const userPosition = this.userDraftPosition(loadedDraft);
      const meta = [presentation.scoring];
      if (userPosition !== null) {
        meta.push(`Pick ${userPosition.label}`);
      }

      return {
        draftId: item.draftId,
        title: presentation.name,
        subtitle: `${presentation.type} • ${presentation.status}`,
        meta,
      };
    }

    let title = item.url;
    try {
      const parsedUrl = new URL(item.url);
      title = `${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch {
      title = item.url;
    }

    return {
      draftId: item.draftId,
      title,
      subtitle: `Draft ID: ${item.draftId}`,
      meta: [],
    };
  }

  private draftLeague(draft: SleeperDraft) {
    const selectedLeague = this.appStore.selectedLeague();
    if (!selectedLeague) {
      return null;
    }

    if (!draft.league_id || draft.league_id === selectedLeague.league_id) {
      return selectedLeague;
    }

    return null;
  }

  private userDraftSlot(draft: SleeperDraft): number | null {
    return this.userDraftPosition(draft)?.slot ?? null;
  }

  private userDraftPosition(draft: SleeperDraft) {
    return getSleeperUserDraftPosition(draft, this.appStore.user()?.user_id);
  }
}
