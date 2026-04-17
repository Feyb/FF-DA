import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PlayerDetailItemComponent } from "../player-detail-item";
import { PlayerDetailGridItem } from "./player-details-grid.types";

@Component({
  selector: "app-player-details-grid",
  templateUrl: "./player-details-grid.component.html",
  styleUrl: "./player-details-grid.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PlayerDetailItemComponent],
})
export class PlayerDetailsGridComponent {
  readonly items = input.required<readonly PlayerDetailGridItem[]>();
  readonly columns = input<1 | 2>(1);
}
