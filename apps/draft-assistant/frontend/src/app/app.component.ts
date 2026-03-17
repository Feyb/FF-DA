import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatToolbarModule, MatIconModule],
})
export class AppComponent {
  protected readonly appStore = inject(AppStore);
  protected readonly navLinks: NavLink[] = [
    { path: '/home', label: 'Home' },
    { path: '/team', label: 'Team' },
    { path: '/players', label: 'Players' },
    { path: '/draft', label: 'Draft' },
  ];
}
