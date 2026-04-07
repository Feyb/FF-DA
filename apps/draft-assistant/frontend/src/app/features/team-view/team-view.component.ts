import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TeamViewRating } from '../../core/models';
import { AppStore } from '../../core/state/app.store';
import { TeamViewStore } from './team-view.store';
import { TierLegendComponent } from '../../shared/components/tier-legend';
import { LoadingStateComponent } from '../../shared/components/loading-state';
import { ErrorStateComponent } from '../../shared/components/error-state';
import { PLAYER_FALLBACK_IMAGE } from '../../core/constants/images.constants';

@Component({
  selector: 'app-team-view',
  templateUrl: './team-view.component.html',
  styleUrl: './team-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TeamViewStore],
  imports: [
    CommonModule,
    DecimalPipe,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    TierLegendComponent,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
})
export class TeamViewComponent {
  protected readonly store = inject(TeamViewStore);
  protected readonly appStore = inject(AppStore);
  protected readonly playerFallbackImage = PLAYER_FALLBACK_IMAGE;

  protected readonly positionLabels: Array<keyof TeamViewRating['positionScores']> = [
    'QB',
    'RB',
    'WR',
    'TE',
  ];

  protected readonly myRank = computed(() => {
    const id = this.store.selectedRosterId();
    return this.store.leagueStandings().find((e) => e.rosterId === id)?.rank ?? null;
  });

  protected onRosterSelect(event: MatSelectChange): void {
    const rosterId = Number(event.value);
    if (!Number.isNaN(rosterId)) {
      this.store.selectRoster(rosterId);
    }
  }

  protected retryLoad(): void {
    this.store.retry();
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

  protected getTierClass(tier: number | null): string {
    if (tier === null) {
      return 'tier-unranked';
    }
    const tierNum = Math.max(1, Math.min(tier, 10));
    const cycledTier = ((tierNum - 1) % 10) + 1;
    return `tier-${cycledTier}`;
  }

  protected readonly positionOrder = ['QB', 'RB', 'WR', 'TE'];

  protected getStartersByPosition(position: string) {
    return this.store.sections().starters.filter((p) => p.position === position);
  }

  protected getBenchByPosition(position: string) {
    return this.store.sections().bench.filter((p) => p.position === position);
  }
}
