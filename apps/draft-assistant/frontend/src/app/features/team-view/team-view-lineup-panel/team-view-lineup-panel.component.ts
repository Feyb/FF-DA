import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { NgClass } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import {
  LineupSuggestion,
  MatchupGrade,
  PlayerMatchup,
  TeamViewPlayer,
} from "../../../core/models";

interface MatchupRow {
  player: TeamViewPlayer;
  matchup: PlayerMatchup | null;
}

@Component({
  selector: "app-team-view-lineup-panel",
  templateUrl: "./team-view-lineup-panel.component.html",
  styleUrl: "./team-view-lineup-panel.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatIconModule],
})
export class TeamViewLineupPanelComponent {
  readonly starters = input.required<TeamViewPlayer[]>();
  readonly bench = input.required<TeamViewPlayer[]>();
  readonly matchups = input.required<Map<string, PlayerMatchup>>();
  readonly suggestions = input.required<LineupSuggestion[]>();
  readonly currentWeek = input<number | null>(null);

  protected readonly starterRows = computed<MatchupRow[]>(() =>
    this.starters()
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .map((p) => ({ player: p, matchup: this.matchups().get(p.playerId) ?? null })),
  );

  protected readonly benchRows = computed<MatchupRow[]>(() =>
    this.bench()
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .map((p) => ({ player: p, matchup: this.matchups().get(p.playerId) ?? null })),
  );

  protected gradeClass(grade: MatchupGrade | null | undefined): string {
    if (!grade) return "grade-unknown";
    return `grade-${grade.toLowerCase()}`;
  }

  protected avgPtsLabel(pts: number | null): string {
    return pts != null ? pts.toFixed(1) : "—";
  }

  protected rankLabel(rank: number | null): string {
    return rank != null ? `#${rank}` : "—";
  }

  protected opponentLabel(matchup: PlayerMatchup | null): string {
    if (!matchup) return "—";
    if (matchup.onBye) return "BYE";
    return matchup.opponentTeam ?? "—";
  }
}
