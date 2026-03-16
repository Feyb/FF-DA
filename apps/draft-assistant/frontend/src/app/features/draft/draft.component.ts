import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-draft',
  template: '<p class="p-8 text-lg">Draft — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftComponent {}
