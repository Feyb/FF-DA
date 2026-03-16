import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-players',
  template: '<p class="p-8 text-lg">Players — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersComponent {}
