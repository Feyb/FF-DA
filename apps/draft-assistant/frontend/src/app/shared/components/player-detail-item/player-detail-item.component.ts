import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-player-detail-item",
  templateUrl: "./player-detail-item.component.html",
  styleUrl: "./player-detail-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerDetailItemComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly subtext = input<string | null>(null);
}
