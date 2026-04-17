import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { TierSource } from "../../../core/models";
import { SelectFieldComponent, SelectOption } from "../select-field";

export type PositionFilter = "QB" | "RB" | "WR" | "TE";
export type ValueSource = "ktcValue" | "averageRank";

@Component({
  selector: "app-player-filters",
  templateUrl: "./player-filters.component.html",
  styleUrl: "./player-filters.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatSlideToggleModule, SelectFieldComponent],
})
export class PlayerFiltersComponent {
  readonly positions = input<ReadonlyArray<PositionFilter>>(["QB", "RB", "WR", "TE"]);
  readonly selectedPositions = input<ReadonlyArray<PositionFilter>>([]);
  readonly rookiesOnly = input<boolean>(false);
  readonly tierSource = input<TierSource>("average");
  readonly valueSource = input<ValueSource>("ktcValue");

  readonly tierSources = input<ReadonlyArray<SelectOption<TierSource>>>([
    { value: "average", label: "Average (KTC + Flock)" },
    { value: "flock", label: "Flock" },
    { value: "ktc", label: "KTC" },
  ]);

  readonly valueSources = input<ReadonlyArray<SelectOption<ValueSource>>>([
    { value: "ktcValue", label: "KTC Value" },
    { value: "averageRank", label: "Flock Average Rank" },
  ]);

  readonly positionToggle = output<PositionFilter>();
  readonly rookiesOnlyChange = output<boolean>();
  readonly tierSourceChange = output<TierSource>();
  readonly valueSourceChange = output<ValueSource>();

  protected isPositionSelected(position: PositionFilter): boolean {
    return this.selectedPositions().includes(position);
  }

  protected onPositionClick(position: PositionFilter): void {
    this.positionToggle.emit(position);
  }

  protected onRookiesOnlyChange(value: boolean): void {
    this.rookiesOnlyChange.emit(value);
  }

  protected onTierSourceChange(value: TierSource): void {
    this.tierSourceChange.emit(value);
  }

  protected onValueSourceChange(value: ValueSource): void {
    this.valueSourceChange.emit(value);
  }
}
