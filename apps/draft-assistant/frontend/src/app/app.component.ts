import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { AppStore, DENSITY_SCALES } from "./core/state/app.store";
import { DarkModeToggleComponent } from "./shared/components/dark-mode-toggle";
import { DensitySettingsComponent } from "./shared/components/density-settings";

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatToolbarModule,
    MatIconModule,
    DarkModeToggleComponent,
    DensitySettingsComponent,
  ],
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly appStore = inject(AppStore);
  protected readonly navLinks: NavLink[] = [
    { path: "/home", label: "Home" },
    { path: "/team", label: "Team" },
    { path: "/players", label: "Players" },
    { path: "/draft", label: "Draft" },
  ];

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      for (const option of DENSITY_SCALES) {
        root.classList.remove(`app-density-${option}`);
      }
      root.classList.add(`app-density-${this.appStore.densityScale()}`);
    });

    effect(() => {
      const root = this.document.documentElement;
      if (this.appStore.darkMode()) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    });
  }
}
