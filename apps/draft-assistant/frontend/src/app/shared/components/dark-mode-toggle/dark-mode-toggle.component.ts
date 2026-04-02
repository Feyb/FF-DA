import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppStore } from '../../../core/state/app.store';

@Component({
  selector: 'app-dark-mode-toggle',
  templateUrl: './dark-mode-toggle.component.html',
  styleUrl: './dark-mode-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DarkModeToggleComponent {
  private static nextId = 0;

  protected readonly appStore = inject(AppStore);
  protected readonly isExpanding = signal(false);
  /** Stable unique ID so the SVG mask reference is scoped per instance. */
  protected readonly maskId = `dm-crescent-mask-${DarkModeToggleComponent.nextId++}`;

  protected onToggle(): void {
    this.appStore.toggleDarkMode();
    this.isExpanding.set(true);
  }

  protected onAnimationEnd(): void {
    this.isExpanding.set(false);
  }
}
