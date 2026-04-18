import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { AppStore } from "../../../core/state/app.store";
import { DarkModeToggleComponent } from "../dark-mode-toggle";
import { DensitySettingsComponent } from "../density-settings";
import { NAV_LINKS, NavLink } from "../../nav-links.constant";

@Component({
  selector: "app-bottom-nav",
  templateUrl: "./bottom-nav.component.html",
  styleUrl: "./bottom-nav.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    DarkModeToggleComponent,
    DensitySettingsComponent,
  ],
})
export class BottomNavComponent {
  protected readonly appStore = inject(AppStore);
  readonly navLinks: NavLink[] = NAV_LINKS;
}
