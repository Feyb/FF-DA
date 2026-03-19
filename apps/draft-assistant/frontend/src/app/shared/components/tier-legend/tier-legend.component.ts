import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tier-legend',
  templateUrl: './tier-legend.component.html',
  styleUrl: './tier-legend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class TierLegendComponent {
  /** Array of tier values to display. Defaults to 1-10 for draft tiers. */
  readonly tiers = input<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  /** Function to compute CSS class for a tier value. Defaults to draft tier coloring. */
  readonly tierColorClass = input<(tier: number | null) => string>(this.defaultTierColorClass);

  protected defaultTierColorClass(tier: number | null): string {
    if (tier === null) {
      return 'tier-unranked';
    }
    const tierNum = Math.max(1, Math.min(tier, 10));
    const cycledTier = ((tierNum - 1) % 10) + 1;
    return `tier-${cycledTier}`;
  }

  protected getItemClass(tier: number): string {
    return this.tierColorClass()(tier);
  }
}
