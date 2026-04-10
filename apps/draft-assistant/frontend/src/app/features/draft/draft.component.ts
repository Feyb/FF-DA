import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, OnInit, OnDestroy } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  extractSleeperDraftId,
  getSleeperDraftNameLabel,
  getSleeperDraftPresentation,
  getSleeperDraftScoringLabel,
  getSleeperDraftStatusLabel,
  getSleeperDraftTypeLabel,
  getSleeperUserDraftPosition,
  SleeperUserDraftPosition,
} from '../../core/adapters/sleeper/sleeper-draft.util';
import { DraftPlayerRow, DraftRecommendation, SleeperDraft } from '../../core/models';
import { AppStore } from '../../core/state/app.store';
import {
  BestAvailableEntry,
  DraftPlayerDisplayRow,
  DraftPositionFilter,
  DraftSortSource,
  DraftSourceMode,
  DraftValueSource,
  DraftStore,
  TierDropAlert,
  PositionalNeedEntry,
  rankForSortSource,
  positionalRankForSortSource,
} from './draft.store';
import { TierLegendComponent } from '../../shared/components/tier-legend';
import { DraftBoardGridComponent } from './draft-board-grid/draft-board-grid.component';
import { TierSource } from '../../core/models';
import { PLAYER_FALLBACK_IMAGE } from '../../core/constants/images.constants';
import { resolveTier } from '../../core/utils/tier-resolution.util';
import { StorageService } from '../../core/services/storage.service';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { LoadingStateComponent } from '../../shared/components/loading-state';
import { ErrorStateComponent } from '../../shared/components/error-state';

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
    MatTooltipModule,
    TierLegendComponent,
    DraftBoardGridComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
})
export class DraftComponent implements OnInit, OnDestroy {
  protected readonly store = inject(DraftStore);
  protected readonly appStore = inject(AppStore);
  private readonly storage = inject(StorageService);
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
  protected readonly sortSources: Array<{ value: DraftSortSource; label: string }> = [
    { value: 'combinedTier', label: 'Combined Tier' },
    { value: 'ktcRank', label: 'KTC Rank' },
    { value: 'flockRank', label: 'Flock Rank' },
    { value: 'sleeperRank', label: 'Sleeper Rank' },
    { value: 'combinedPositionalTier', label: 'Combined Pos. Tier' },
    { value: 'adpDelta', label: 'ADP Value (Delta)' },
    { value: 'valueGap', label: 'Value Gap' },
  ];
  private static readonly MAX_VISIBLE_PLAYERS = 120;
  /** Memoized slice of the player list to avoid repeated slicing in template. */
  protected readonly visiblePlayerRows = computed(() =>
    this.store.allPlayerRows().slice(0, DraftComponent.MAX_VISIBLE_PLAYERS),
  );
  /**
   * Undrafted-only subset of `visiblePlayerRows`.
   * Used for divider logic so drafted rows don't shift tier/pick boundary indices.
   */
  protected readonly visibleUndraftedRows = computed(() =>
    this.visiblePlayerRows().filter((r) => !r.isDrafted),
  );
  /**
   * Maps each undrafted player's playerId to its index within `visibleUndraftedRows`.
   * Allows the template to look up the undrafted-list index in O(1).
   */
  protected readonly undraftedIndexMap = computed(() => {
    const map = new Map<string, number>();
    this.visibleUndraftedRows().forEach((r, i) => map.set(r.playerId, i));
    return map;
  });
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
  /** Delegate to store's userNextPickNumber computed (REQ-PA-03). */
  protected readonly userNextPickNumber = computed(() => this.store.userNextPickNumber());

  /** Auto-dismiss tier drop alerts after 8 seconds (REQ-TD-03). */
  private readonly _scheduledAlertIds = new Set<string>();
  private readonly _alertTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _tierAlertAutoDismiss = effect(() => {
    const alerts = this.store.tierDropAlerts();
    for (const alert of alerts) {
      if (this._scheduledAlertIds.has(alert.id)) continue;
      this._scheduledAlertIds.add(alert.id);
      const age = Date.now() - alert.createdAt;
      const delay = Math.max(0, 8000 - age);
      const handle = setTimeout(() => {
        this._scheduledAlertIds.delete(alert.id);
        this._alertTimeouts.delete(alert.id);
        this.store.dismissTierAlert(alert.id);
      }, delay);
      this._alertTimeouts.set(alert.id, handle);
    }
  });

  ngOnInit(): void {
    this.loadSavedDirectUrls();
  }

  ngOnDestroy(): void {
    for (const handle of this._alertTimeouts.values()) {
      clearTimeout(handle);
    }
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

  protected resetSession(): void {
    this.store.resetSession();
  }

  protected loadSavedDirectUrls(): void {
    const parsed = this.storage.getItem<Array<{ url: string; draftId: string }>>(this.directUrlStorageKey);
    this.savedDirectUrls.set(Array.isArray(parsed) ? parsed : []);
  }

  protected saveDirectUrl(url: string, draftId: string): void {
    const current = this.savedDirectUrls();
    const exists = current.some((item) => item.draftId === draftId);
    if (!exists) {
      const updated = [{ url, draftId }, ...current];
      this.savedDirectUrls.set(updated);
      this.storage.setItem(this.directUrlStorageKey, updated);
    }
  }

  protected clearSavedUrls(): void {
    this.savedDirectUrls.set([]);
    this.storage.removeItem(this.directUrlStorageKey);
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

  protected shouldShowTierDivider(undraftedRows: DraftPlayerDisplayRow[], undraftedIndex: number): boolean {
    if (undraftedIndex === 0) {
      return true;
    }

    const currentTier = undraftedRows[undraftedIndex] ? this.rowCombinedTier(undraftedRows[undraftedIndex]) : null;
    const previousTier = undraftedRows[undraftedIndex - 1] ? this.rowCombinedTier(undraftedRows[undraftedIndex - 1]) : null;
    return currentTier !== previousTier;
  }

  protected shouldShowNextPickDivider(undraftedRows: DraftPlayerDisplayRow[], undraftedIndex: number): boolean {
    const userNextPick = this.userNextPickNumber();
    if (!userNextPick || undraftedIndex === 0) {
      return false;
    }

    const pickedCount = this.store.picks().length;
    const picksBetweenNowAndUserPick = userNextPick - pickedCount - 1;

    return undraftedIndex === picksBetweenNowAndUserPick;
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
    const tier = this.rowCombinedTier(row);
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

  /** Combined tier for display in the player list (used for tier dividers). */
  protected rowCombinedTier(row: DraftPlayerRow): number | null {
    return row.combinedTier;
  }

  /** Rank value for the active sort source (REQ-PL-06). */
  protected rowRank(row: DraftPlayerRow): number | null {
    return rankForSortSource(row, this.store.sortSource());
  }

  /** Positional rank/tier for the active sort source (REQ-PL-06). */
  protected rowPositionalRank(row: DraftPlayerRow): number | null {
    return positionalRankForSortSource(row, this.store.sortSource());
  }

  /** Label for the active sort source rank column. */
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

  /** ADP delta display string with sign (REQ-ADP-03). */
  protected adpDeltaLabel(delta: number | null): string {
    if (delta === null) return '—';
    if (delta > 0) return `+${delta}`;
    return String(delta);
  }

  /** CSS class for ADP delta color coding (REQ-ADP-04). */
  protected adpDeltaClass(delta: number | null): string {
    if (delta === null) return '';
    if (delta > 1) return 'adp-value';
    if (delta < -1) return 'adp-reach';
    return 'adp-neutral';
  }

  /** CSS class and label for value gap colored indicator (REQ-VG-02). */
  protected valueGapClass(gap: number | null): string {
    if (gap === null) return 'vg-none';
    if (gap === 0) return 'vg-consensus';
    if (gap === 1) return 'vg-minor';
    return 'vg-high';
  }

  /** Tooltip text for value gap indicator (REQ-VG-03). */
  protected valueGapTooltip(row: DraftPlayerRow): string {
    const ktcTier = row.overallTier;
    const flockTier = row.flockAverageTier;
    if (ktcTier === null && flockTier === null) return 'No tier data';
    const parts: string[] = [];
    if (ktcTier !== null) parts.push(`KTC: Tier ${ktcTier}`);
    if (flockTier !== null) parts.push(`Flock: Tier ${flockTier}`);
    return parts.join(' · ');
  }

  /** Label for a tier drop alert banner (REQ-TD-02). */
  protected tierAlertLabel(alert: TierDropAlert): string {
    const pos = alert.position;
    const dropped = alert.droppedTier;
    if (alert.nextTier !== null) {
      return `Last Tier ${dropped} ${pos} drafted — Tier ${alert.nextTier} ${pos}s now available`;
    }
    return `Last Tier ${dropped} ${pos} drafted — no more ${pos}s in ranked tiers`;
  }

  /** Dismiss a tier drop alert (REQ-TD-03). */
  protected dismissAlert(id: string): void {
    // Clear the auto-dismiss timeout if it's still pending (REQ-TD-03)
    const handle = this._alertTimeouts.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this._alertTimeouts.delete(id);
    }
    this._scheduledAlertIds.delete(id);
    this.store.dismissTierAlert(id);
  }

  /** Toggle needed-positions-only filter (REQ-PL-11). */
  protected toggleNeededPositionsOnly(): void {
    this.store.toggleNeededPositionsOnly();
  }

  /** Format positional need entry for display (REQ-PN-03). */
  protected needLabel(need: PositionalNeedEntry): string {
    return `${need.remaining}/${need.configured}`;
  }

  /** Create a number array of a given length for @for loops. */
  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  /** Picks-until-my-turn counter label (REQ-PA-03). */
  protected picksUntilMyTurnLabel(): string {
    const nextPick = this.userNextPickNumber();
    if (!nextPick) return '';
    const currentPick = this.store.picks().length + 1;
    const picks = nextPick - currentPick;
    if (picks === 0) return 'Your pick now!';
    if (picks === 1) return '1 pick until your turn';
    return `${picks} picks until your turn`;
  }

  /** Rank value for a best-available entry based on the active sort source. */
  protected bestAvailableRank(entry: BestAvailableEntry): number | null {
    return entry.player ? rankForSortSource(entry.player, this.store.sortSource()) : null;
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

  private userDraftPosition(draft: SleeperDraft): SleeperUserDraftPosition | null {
    return getSleeperUserDraftPosition(draft, this.appStore.user()?.user_id);
  }
}
