import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PLAYER_FALLBACK_IMAGE } from '../../../core/constants/images.constants';
import { TeamViewPlayer } from '../../../core/models';

interface PlayerGroup {
  heading: string | null;
  players: TeamViewPlayer[];
}

@Component({
  selector: 'app-team-view-players-list',
  templateUrl: './team-view-players-list.component.html',
  styleUrl: './team-view-players-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule],
})
export class TeamViewPlayersListComponent {
  readonly sectionTitle = input.required<string>();
  readonly players = input.required<TeamViewPlayer[]>();
  readonly emptyMessage = input.required<string>();
  readonly positionOrder = input<readonly string[]>(['QB', 'RB', 'WR', 'TE']);
  readonly groupByPosition = input<boolean>(true);

  protected readonly playerFallbackImage = PLAYER_FALLBACK_IMAGE;
  private readonly expandedPlayerIds = signal<Set<string>>(new Set());

  protected readonly groupedPlayers = computed<PlayerGroup[]>(() => {
    const players = this.players();
    if (!this.groupByPosition()) {
      return [{ heading: null, players }];
    }

    const groups = new Map<string, TeamViewPlayer[]>();
    for (const position of this.positionOrder()) {
      groups.set(position, []);
    }

    for (const player of players) {
      const position = player.position || 'Other';
      const grouped = groups.get(position);
      if (grouped) {
        grouped.push(player);
        continue;
      }
      groups.set(position, [player]);
    }

    return Array.from(groups.entries())
      .filter(([, groupedPlayers]) => groupedPlayers.length > 0)
      .map(([heading, groupedPlayers]) => ({ heading, players: groupedPlayers }));
  });

  protected toggleExpanded(playerId: string): void {
    this.expandedPlayerIds.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  protected isExpanded(playerId: string): boolean {
    return this.expandedPlayerIds().has(playerId);
  }

  protected playerHeadshotUrl(playerId: string): string {
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  }

  protected onPlayerImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.playerFallbackImage) {
      return;
    }
    img.src = this.playerFallbackImage;
  }

  protected getTierClass(tier: number | null): string {
    if (tier === null) {
      return 'tier-unranked';
    }
    const tierNum = Math.max(1, Math.min(tier, 10));
    const cycledTier = ((tierNum - 1) % 10) + 1;
    return `tier-${cycledTier}`;
  }

  protected teamLabel(player: TeamViewPlayer): string {
    return player.team ?? 'FA';
  }

  protected ageLabel(player: TeamViewPlayer): string {
    return player.age === null ? '—' : String(player.age);
  }

  protected expLabel(player: TeamViewPlayer): string {
    return player.yearsExp === null ? '—' : String(player.yearsExp);
  }

  protected injuryLabel(player: TeamViewPlayer): string {
    return player.injuryStatus ?? 'Healthy';
  }

  protected numberLabel(value: number | null): string {
    return value === null ? '—' : String(value);
  }

  protected deltaLabel(value: number | null): string {
    if (value === null) {
      return '—';
    }
    if (value > 0) {
      return `+${value}`;
    }
    return String(value);
  }
}
