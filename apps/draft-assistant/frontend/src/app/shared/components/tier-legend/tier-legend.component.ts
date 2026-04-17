import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { getTierColorClass } from "../../pipes/tier-color.pipe";

@Component({
  selector: "app-tier-legend",
  templateUrl: "./tier-legend.component.html",
  styleUrl: "./tier-legend.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class TierLegendComponent {
  /** Array of tier values to display. Defaults to 1-10 for draft tiers. */
  readonly tiers = input<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  /** Function to compute CSS class for a tier value. Defaults to draft tier coloring. */
  readonly tierColorClass = input<(tier: number | null) => string>(getTierColorClass);

  protected getItemClass(tier: number): string {
    return this.tierColorClass()(tier);
  }
}
