import { Injectable } from "@angular/core";
import {
  LineupSuggestion,
  MatchupGrade,
  NflDefenseStatsAsset,
  PlayerMatchup,
  TeamViewPlayer,
} from "../models";

const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

@Injectable({ providedIn: "root" })
export class LineupSuggestionService {
  /** Map a defense rank (1–32) to a matchup grade. 1 = easiest = A. */
  gradeRank(rank: number): MatchupGrade {
    if (rank <= 8) return "A";
    if (rank <= 16) return "B";
    if (rank <= 24) return "C";
    if (rank <= 29) return "D";
    return "F";
  }

  getMatchup(
    player: TeamViewPlayer,
    week: number,
    defenseStats: NflDefenseStatsAsset,
  ): PlayerMatchup {
    const { playerId, team, position } = player;

    if (!team || !SKILL_POSITIONS.has(position)) {
      return {
        playerId,
        opponentTeam: null,
        onBye: false,
        defenseRank: null,
        curAvgPtsAllowed: null,
        prevAvgPtsAllowed: null,
        grade: null,
      };
    }

    const weekStr = String(week);
    const opponentTeam = defenseStats.schedule[team]?.[weekStr] ?? null;

    if (opponentTeam === null) {
      return {
        playerId,
        opponentTeam: null,
        onBye: true,
        defenseRank: null,
        curAvgPtsAllowed: null,
        prevAvgPtsAllowed: null,
        grade: null,
      };
    }

    const posKey = position as "QB" | "RB" | "WR" | "TE";
    const defEntry = defenseStats.teams[opponentTeam]?.[posKey] ?? null;

    return {
      playerId,
      opponentTeam,
      onBye: false,
      defenseRank: defEntry?.curRank ?? null,
      curAvgPtsAllowed: defEntry?.curAvgPts ?? null,
      prevAvgPtsAllowed: defEntry?.prevAvgPts ?? null,
      grade: defEntry?.curRank != null ? this.gradeRank(defEntry.curRank) : null,
    };
  }

  buildMatchupMap(
    players: TeamViewPlayer[],
    week: number,
    defenseStats: NflDefenseStatsAsset,
  ): Map<string, PlayerMatchup> {
    const map = new Map<string, PlayerMatchup>();
    for (const player of players) {
      map.set(player.playerId, this.getMatchup(player, week, defenseStats));
    }
    return map;
  }

  buildSuggestions(
    starters: TeamViewPlayer[],
    bench: TeamViewPlayer[],
    matchups: Map<string, PlayerMatchup>,
  ): LineupSuggestion[] {
    const suggestions: LineupSuggestion[] = [];

    const benchByPosition = new Map<string, TeamViewPlayer[]>();
    for (const player of bench) {
      if (!SKILL_POSITIONS.has(player.position)) continue;
      const list = benchByPosition.get(player.position);
      if (list) {
        list.push(player);
      } else {
        benchByPosition.set(player.position, [player]);
      }
    }

    for (const starter of starters) {
      if (!SKILL_POSITIONS.has(starter.position)) continue;

      const starterMatchup = matchups.get(starter.playerId);
      if (!starterMatchup) continue;

      // Treat bye as rank 33 (worse than any real defense rank)
      const starterRank = starterMatchup.onBye ? 33 : (starterMatchup.defenseRank ?? 17);

      const benchCandidates = benchByPosition.get(starter.position) ?? [];

      for (const candidate of benchCandidates) {
        const candidateMatchup = matchups.get(candidate.playerId);
        if (!candidateMatchup || candidateMatchup.onBye) continue;

        const candidateRank = candidateMatchup.defenseRank ?? 17;

        // Suggest swap when bench player has a meaningfully better matchup:
        // at least 8 ranks easier AND the current starter faces a tough spot (rank ≥ 20) or is on bye
        if (candidateRank < starterRank - 8 && (starterRank >= 20 || starterMatchup.onBye)) {
          const opponent = candidateMatchup.opponentTeam ?? "opponent";
          const avgPts =
            candidateMatchup.curAvgPtsAllowed != null
              ? `${candidateMatchup.curAvgPtsAllowed.toFixed(1)} PPR pts/game`
              : "unknown pts/game";

          let reason: string;
          if (starterMatchup.onBye) {
            reason =
              `${starter.fullName} is on bye. ` +
              `${opponent} allows ${avgPts} to ${starter.position}s ` +
              `(rank #${candidateRank} easiest).`;
          } else {
            const starterOpponent = starterMatchup.opponentTeam ?? "their opponent";
            reason =
              `${opponent} allows ${avgPts} to ${starter.position}s ` +
              `(rank #${candidateRank} easiest) vs ` +
              `${candidate.fullName}'s current matchup vs ${starterOpponent} (rank #${starterRank}).`;
          }

          suggestions.push({
            position: starter.position,
            toStart: candidate,
            toSit: starter,
            reason,
          });
          break; // one suggestion per starter slot
        }
      }
    }

    return suggestions;
  }
}
