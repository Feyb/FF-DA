export type PositionFilter = "QB" | "RB" | "WR" | "TE";
export type SortBy = "default" | "name" | "position" | "age" | "ktcValue" | "team";
export type SortDirection = "asc" | "desc";
export type ValueSource = "ktcValue" | "averageRank";

export interface PlayerRow {
  playerId: string;
  fullName: string;
  position: PositionFilter;
  team: string | null;
  age: number | null;
  rookie: boolean;
  ktcValue: number | null;
  averageRank: number | null;
  ktcRank: number | null;
  overallTier: number | null;
  positionalTier: number | null;
  flockAverageTier: number | null;
  flockAveragePositionalTier: number | null;
  sleeperRank: number;
}

export function filterAndSortPlayerRows(
  rows: PlayerRow[],
  selectedPositions: PositionFilter[],
  rookiesOnly: boolean,
  sortBy: SortBy,
  sortDirection: SortDirection,
  valueSource: ValueSource,
  searchQuery: string,
): PlayerRow[] {
  const selected = new Set(selectedPositions);
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filtered = rows.filter((row) => {
    if (normalizedQuery && !row.fullName.toLowerCase().includes(normalizedQuery)) return false;
    if (!selected.has(row.position)) return false;
    if (rookiesOnly && !row.rookie) return false;
    return true;
  });

  const dir = sortDirection === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    if (sortBy === "default") {
      const aRank =
        (valueSource === "ktcValue" ? a.ktcRank : (a.averageRank ?? a.ktcRank)) ??
        Number.MAX_SAFE_INTEGER;
      const bRank =
        (valueSource === "ktcValue" ? b.ktcRank : (b.averageRank ?? b.ktcRank)) ??
        Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.sleeperRank - b.sleeperRank;
    }

    if (sortBy === "name") {
      return a.fullName.localeCompare(b.fullName) * dir;
    }

    if (sortBy === "position") {
      return a.position.localeCompare(b.position) * dir;
    }

    if (sortBy === "age") {
      const aAge = a.age ?? Number.MAX_SAFE_INTEGER;
      const bAge = b.age ?? Number.MAX_SAFE_INTEGER;
      return (aAge - bAge) * dir;
    }

    if (sortBy === "ktcValue") {
      const aValue = (valueSource === "ktcValue" ? a.ktcValue : a.averageRank) ?? -1;
      const bValue = (valueSource === "ktcValue" ? b.ktcValue : b.averageRank) ?? -1;
      return (aValue - bValue) * dir;
    }

    const aTeam = a.team ?? "ZZZ";
    const bTeam = b.team ?? "ZZZ";
    return aTeam.localeCompare(bTeam) * dir;
  });
}
