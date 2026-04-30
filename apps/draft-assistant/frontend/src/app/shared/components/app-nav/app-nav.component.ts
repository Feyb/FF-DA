import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatMenuModule } from "@angular/material/menu";
import { MatRadioModule } from "@angular/material/radio";
import { AppStore, DENSITY_SCALES } from "../../../core/state/app.store";
import { DarkModeToggleComponent } from "../dark-mode-toggle";
import { NavIconComponent } from "../nav-icon";
import { NAV_LINKS, NavLink } from "../../nav-links.constant";

@Component({
  selector: "app-nav",
  templateUrl: "./app-nav.component.html",
  styleUrl: "./app-nav.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatRadioModule,
    DarkModeToggleComponent,
    NavIconComponent,
  ],
})
export class AppNavComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly appStore = inject(AppStore);

  readonly densityOptions: readonly number[] = DENSITY_SCALES;
  readonly navLinks: NavLink[] = NAV_LINKS;

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

  onDensityChange(value: number): void {
    this.appStore.setDensityScale(value);
  }

  densityLabel(value: number): string {
    return value === 0 ? "Default" : `Compact ${value}`;
  }
}
