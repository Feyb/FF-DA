import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

@Component({
  selector: "app-loading-state",
  templateUrl: "./loading-state.component.html",
  styleUrl: "./loading-state.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
})
export class LoadingStateComponent {
  readonly message = input("Loading…");
  readonly diameter = input(36);
}
