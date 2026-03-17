import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

  protected readonly positionLabels: Array<keyof TeamViewRating['positionScores']> = [
    'QB',
    'RB',
    'WR',
    'TE',
  ];

  protected onRosterSelect(event: MatSelectChange): void {
    const rosterId = Number(event.value);
    if (!Number.isNaN(rosterId)) {
      this.store.selectRoster(rosterId);
    }
  }

  protected retryLoad(): void {
    this.store.retry();
  }
}
