import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { LeagueStandingEntry } from "../../../core/models";

@Component({
  selector: "app-team-view-standings-panel",
  templateUrl: "./team-view-standings-panel.component.html",
  styleUrl: "./team-view-standings-panel.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule],
})
export class TeamViewStandingsPanelComponent {
  readonly standings = input.required<LeagueStandingEntry[]>();
  readonly myRank = input<number | null>(null);
  readonly selectedRosterId = input<number | null>(null);
}
