import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppStore } from '../../../core/state/app.store';

@Component({
  selector: 'app-dark-mode-toggle',
  templateUrl: './dark-mode-toggle.component.html',
  styleUrl: './dark-mode-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DarkModeToggleComponent {
  protected readonly appStore = inject(AppStore);
  protected readonly isExpanding = signal(false);

  protected onToggle(): void {
    this.appStore.toggleDarkMode();
    this.isExpanding.set(true);
  }

  protected onAnimationEnd(): void {
    this.isExpanding.set(false);
  }
}
