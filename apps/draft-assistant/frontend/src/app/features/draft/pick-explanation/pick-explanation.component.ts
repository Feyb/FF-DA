import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { CommonModule } from "@angular/common";

/** Threshold above which the divergence bar is shown. */
const DIVERGENCE_BAR_THRESHOLD = 1.5;

@Component({
  selector: "app-pick-explanation",
  templateUrl: "./pick-explanation.component.html",
  styleUrl: "./pick-explanation.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class PickExplanationComponent {
  /** Joined explanation string from generateExplanation() — clauses separated by " • ". */
  readonly explanation = input<string>("");
  /** BaseValue divergence (σ units). Shows divergence bar when ≥ 1.5. */
  readonly baseValueDivergence = input<number | null>(null);

  protected readonly clauses = computed((): string[] => {
    const raw = this.explanation().trim();
    if (!raw) return [];
    return raw.split(" • ").filter((c) => c.length > 0);
  });

  protected readonly showDivergenceBar = computed((): boolean => {
    const d = this.baseValueDivergence();
    return d !== null && d >= DIVERGENCE_BAR_THRESHOLD;
  });
}
