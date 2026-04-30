import { ChangeDetectionStrategy, Component, input } from "@angular/core";

export type NavIconName = "home" | "team" | "players" | "football";

@Component({
  selector: "app-nav-icon",
  templateUrl: "./nav-icon.component.html",
  styleUrl: "./nav-icon.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.data-icon]": "name()",
    "aria-hidden": "true",
  },
})
export class NavIconComponent {
  readonly name = input.required<NavIconName>();
}
