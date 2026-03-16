import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatToolbarModule],
})
export class AppComponent {
  protected readonly navLinks: NavLink[] = [
    { path: '/home', label: 'Home' },
    { path: '/team', label: 'Team' },
    { path: '/players', label: 'Players' },
    { path: '/draft', label: 'Draft' },
  ];
}
