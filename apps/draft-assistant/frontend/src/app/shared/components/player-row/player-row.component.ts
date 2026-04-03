import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface PlayerRowData {
  playerId: string;
  fullName: string;
  position: string;
  team: string | null;
  age: number | null;
  ktcRank: number | null;
}

@Component({
  selector: 'app-player-row',
  templateUrl: './player-row.component.html',
  styleUrl: './player-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class PlayerRowComponent {
  readonly player = input.required<PlayerRowData>();
  /** CSS class string for the tier coloring. */
  readonly tierClass = input<string>('');
  /** Primary value to display (e.g. KTC value or flock rank). */
  readonly primaryValue = input<string | number | null>(null);
  /** Secondary label/rank to display. */
  readonly rank = input<string | number | null>(null);
  /** Whether to show the star / bookmark toggle. */
  readonly showStar = input<boolean>(false);
  /** Whether this player is currently starred. */
  readonly starred = input<boolean>(false);

  readonly starToggle = output<string>();

  protected readonly playerFallbackImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2240%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2214%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M18 66c3-12 13-19 22-19s19 7 22 19%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.playerFallbackImage) {
      return;
    }
    img.src = this.playerFallbackImage;
  }

  protected onStarClick(): void {
    this.starToggle.emit(this.player().playerId);
  }
}
