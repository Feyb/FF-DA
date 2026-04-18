import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { NAV_LINKS, NavLink } from "../../nav-links.constant";

@Component({
  selector: "app-bottom-nav",
  templateUrl: "./bottom-nav.component.html",
  styleUrl: "./bottom-nav.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
})
export class BottomNavComponent {
  readonly navLinks: NavLink[] = NAV_LINKS;
}
