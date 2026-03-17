import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TeamViewRating } from '../../core/models';
import { AppStore } from '../../core/state/app.store';
import { TeamViewStore } from './team-view.store';

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
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule,
  ],
})
export class TeamViewComponent {
  protected readonly store = inject(TeamViewStore);
  protected readonly appStore = inject(AppStore);
  protected readonly playerFallbackImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2240%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2214%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M18 66c3-12 13-19 22-19s19 7 22 19%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';

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
    if (tier === null) return 'tier-none';
    if (tier <= 2) return 'tier-s';
    if (tier <= 4) return 'tier-a';
    if (tier <= 6) return 'tier-b';
    if (tier <= 8) return 'tier-c';
    return 'tier-d';
  }

  protected readonly positionOrder = ['QB', 'RB', 'WR', 'TE'];

  protected getStartersByPosition(position: string) {
    return this.store.sections().starters.filter((p) => p.position === position);
  }

  protected getBenchByPosition(position: string) {
    return this.store.sections().bench.filter((p) => p.position === position);
  }
}
