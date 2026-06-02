/**
 * Compute defense vs. position (DvP) stats and NFL schedule from player_stats.csv.
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv
 * Output: src/assets/nflverse/defense-stats.json
 *
 * Per NFL team (as defense):
 *   - Average PPR fantasy points allowed per game to QB, RB, WR, TE (current + prior season)
 *   - Rank 1–32 within each position (1 = easiest matchup, 32 = hardest)
 *
 * Also embeds the weekly schedule (team → week → opponent) derived from the
 * same data, covering all weeks for which game results exist.
 *
 * Usage: node scripts/fetch-nflverse-defense-stats.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "defense-stats.json");

const CSV_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv";
const POSITIONS = ["QB", "RB", "WR", "TE"];

/** RFC-4180-compliant single-line CSV parser (handles quoted commas). */
function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.split("\n");
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

async function fetchCsv(url) {
  console.log(`Fetching ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Find the two most recent REG seasons present in the data.
 * Returns [currentSeason, prevSeason] (both may be the same if only one season).
 */
function detectSeasons(rows) {
  const seasons = new Set();
  for (const row of rows) {
    if (row.season_type !== "REG") continue;
    const s = Number(row.season);
    if (s > 1990) seasons.add(s);
  }
  const sorted = [...seasons].sort((a, b) => b - a);
  const current = sorted[0] ?? new Date().getFullYear() - 1;
  const prev = sorted[1] ?? current - 1;
  return [current, prev];
}

/**
 * Build defense stats: for each (season, opponent_team, position),
 * compute average PPR pts allowed per game.
 *
 * Strategy: sum pts per (season, opponentTeam, position, week), then average over weeks.
 */
function buildDefenseStats(rows, seasonYear, prevSeasonYear) {
  // key: `${season}|${opponentTeam}|${position}|${week}` → total ppr pts that week
  const weekTotals = new Map();

  for (const row of rows) {
    if (row.season_type !== "REG") continue;
    if (!POSITIONS.includes(row.position)) continue;
    const season = Number(row.season);
    if (season !== seasonYear && season !== prevSeasonYear) continue;
    if (!row.opponent_team || !row.week) continue;
    const pts = Number(row.fantasy_points_ppr) || 0;
    const key = `${season}|${row.opponent_team}|${row.position}|${row.week}`;
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + pts);
  }

  // Aggregate week totals → per-team/position/season averages
  const defStats = new Map(); // key: `${season}|${opponentTeam}|${position}`
  for (const [key, total] of weekTotals) {
    const [s, team, pos] = key.split("|");
    const groupKey = `${s}|${team}|${pos}`;
    const existing = defStats.get(groupKey);
    if (existing) {
      existing.totalPts += total;
      existing.gameCount++;
    } else {
      defStats.set(groupKey, { totalPts: total, gameCount: 1 });
    }
  }

  return defStats;
}

/** Rank all teams within each position/season (1 = most pts allowed = easiest matchup). */
function computeRanks(defStats, season) {
  const rankMap = new Map(); // key: `${team}|${position}` → rank
  for (const position of POSITIONS) {
    const entries = [];
    for (const [key, stat] of defStats) {
      const [s, team, pos] = key.split("|");
      if (Number(s) !== season || pos !== position) continue;
      entries.push({ team, avgPts: stat.totalPts / stat.gameCount });
    }
    entries.sort((a, b) => b.avgPts - a.avgPts);
    entries.forEach((e, i) => rankMap.set(`${e.team}|${position}`, i + 1));
  }
  return rankMap;
}

/**
 * Extract schedule from player rows: recent_team played opponent_team in (season, week).
 * Returns: Record<team, Record<week, opponent>> for the given season.
 */
function buildSchedule(rows, seasonYear) {
  const byTeam = {};
  for (const row of rows) {
    if (row.season_type !== "REG") continue;
    if (Number(row.season) !== seasonYear) continue;
    if (!row.recent_team || !row.opponent_team || !row.week) continue;
    if (!byTeam[row.recent_team]) byTeam[row.recent_team] = {};
    byTeam[row.recent_team][row.week] = row.opponent_team;
  }
  return byTeam;
}

async function main() {
  const text = await fetchCsv(CSV_URL);
  const rows = parseCsv(text);

  const [SEASON_YEAR, PREV_SEASON_YEAR] = detectSeasons(rows);
  console.log(`Detected seasons: current=${SEASON_YEAR}, prev=${PREV_SEASON_YEAR}`);

  const defStats = buildDefenseStats(rows, SEASON_YEAR, PREV_SEASON_YEAR);
  const curRanks = computeRanks(defStats, SEASON_YEAR);
  const prevRanks = computeRanks(defStats, PREV_SEASON_YEAR);
  const schedule = buildSchedule(rows, SEASON_YEAR);

  // Collect all teams
  const allTeams = new Set();
  for (const key of defStats.keys()) allTeams.add(key.split("|")[1]);

  const teams = {};
  for (const team of allTeams) {
    teams[team] = {};
    for (const position of POSITIONS) {
      const curKey = `${SEASON_YEAR}|${team}|${position}`;
      const prevKey = `${PREV_SEASON_YEAR}|${team}|${position}`;
      const curStat = defStats.get(curKey);
      const prevStat = defStats.get(prevKey);
      teams[team][position] = {
        curAvgPts: curStat ? Math.round((curStat.totalPts / curStat.gameCount) * 10) / 10 : null,
        curGames: curStat?.gameCount ?? 0,
        curRank: curRanks.get(`${team}|${position}`) ?? null,
        prevAvgPts: prevStat
          ? Math.round((prevStat.totalPts / prevStat.gameCount) * 10) / 10
          : null,
        prevRank: prevRanks.get(`${team}|${position}`) ?? null,
      };
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    currentSeason: SEASON_YEAR,
    teams,
    schedule,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  const schedTeams = Object.keys(schedule).length;
  console.log(
    `Wrote defense stats for ${allTeams.size} teams, schedule for ${schedTeams} teams ` +
      `(season ${SEASON_YEAR}) → ${OUTPUT_FILE}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
