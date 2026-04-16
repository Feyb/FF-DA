import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
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
import { PageHeaderComponent } from '../../shared/components/page-header';
import { TeamViewPlayersListComponent } from './team-view-players-list/team-view-players-list.component';
import { TeamViewStandingsPanelComponent } from './team-view-standings-panel/team-view-standings-panel.component';

@Component({
  selector: 'app-team-view',
  templateUrl: './team-view.component.html',
  styleUrl: './team-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TeamViewStore],
  imports: [
    CommonModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    TierLegendComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    TeamViewPlayersListComponent,
    TeamViewStandingsPanelComponent,
  ],
})
export class TeamViewComponent {
  protected readonly store = inject(TeamViewStore);
  protected readonly appStore = inject(AppStore);

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

  protected readonly positionOrder = ['QB', 'RB', 'WR', 'TE'];
}
