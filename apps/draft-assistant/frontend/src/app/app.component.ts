import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { AppStore } from './core/state/app.store';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatToolbarModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly appStore = inject(AppStore);
  protected readonly densityOptions: number[] = [0, -1, -2, -3, -4, -5];
  protected readonly navLinks: NavLink[] = [
    { path: '/home', label: 'Home' },
    { path: '/team', label: 'Team' },
    { path: '/players', label: 'Players' },
    { path: '/draft', label: 'Draft' },
  ];

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      for (const option of this.densityOptions) {
        root.classList.remove(this.densityClass(option));
      }
      root.classList.add(this.densityClass(this.appStore.densityScale()));
    });
  }

  protected onDensityChange(event: MatSelectChange): void {
    const density = Number(event.value ?? 0);
    this.appStore.setDensityScale(density);
  }

  protected densityLabel(value: number): string {
    return value === 0 ? 'Default (0)' : `Compact (${value})`;
  }

  private densityClass(value: number): string {
    return `app-density-${value}`;
  }
}
