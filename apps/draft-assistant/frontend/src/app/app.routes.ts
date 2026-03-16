import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'team',
    loadComponent: () =>
      import('./features/team-view/team-view.component').then(
        (m) => m.TeamViewComponent,
      ),
  },
  {
    path: 'players',
    loadComponent: () =>
      import('./features/players/players.component').then(
        (m) => m.PlayersComponent,
      ),
  },
  {
    path: 'draft',
    loadComponent: () =>
      import('./features/draft/draft.component').then((m) => m.DraftComponent),
  },
];
