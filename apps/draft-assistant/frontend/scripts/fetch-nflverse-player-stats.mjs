/**
 * Fetch nflverse player_stats seasonal data and emit a slim JSON asset.
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv
 * Output: src/assets/nflverse/player-stats.json
 *
 * Fields extracted (per player, most recent season only):
 *   player_id, player_name, season, games, targets, receptions,
 *   target_share, air_yards_share, wopr, snap_pct, racr, receiving_yards,
 *   rushing_yards, rushing_attempts, rushing_tds, passing_yards, passing_tds
 *
 * Usage: node scripts/fetch-nflverse-player-stats.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "player-stats.json");

const RELEASE_BASE = "https://github.com/nflverse/nflverse-data/releases/download/player_stats";
const FILES = [`${RELEASE_BASE}/player_stats.csv`];

const NUMERIC_FIELDS = [
  "season",
  "games",
  "targets",
  "receptions",
  "target_share",
  "air_yards_share",
  "wopr",
  "snap_pct",
  "racr",
  "receiving_yards",
  "receiving_tds",
  "rushing_yards",
  "rushing_attempts",
  "rushing_tds",
  "passing_yards",
  "passing_tds",
  "passing_air_yards",
];

async function fetchCsv(url) {
  console.log(`Fetching ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseCsv(text) {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

async function main() {
  const text = await fetchCsv(FILES[0]);
  const rows = parseCsv(text);

  // Keep most recent season per player; aggregate across weeks.
  const byPlayer = new Map();
  for (const row of rows) {
    if (!row.player_id) continue;
    const season = Number(row.season ?? 0);
    const existing = byPlayer.get(row.player_id);
    if (existing && existing.season > season) continue;
    if (existing && existing.season === season) {
      // Same season — accumulate game-level stats.
      existing.games = (existing.games ?? 0) + (Number(row.games) || 0);
      existing.targets = (existing.targets ?? 0) + (Number(row.targets) || 0);
      existing.receptions = (existing.receptions ?? 0) + (Number(row.receptions) || 0);
      existing.receiving_yards =
        (existing.receiving_yards ?? 0) + (Number(row.receiving_yards) || 0);
      existing.rushing_yards = (existing.rushing_yards ?? 0) + (Number(row.rushing_yards) || 0);
      existing.rushing_attempts =
        (existing.rushing_attempts ?? 0) + (Number(row.rushing_attempts) || 0);
      existing.passing_yards = (existing.passing_yards ?? 0) + (Number(row.passing_yards) || 0);
      // Rate stats — take season-end values from last row encountered.
      for (const f of ["target_share", "air_yards_share", "wopr", "snap_pct", "racr"]) {
        if (row[f]) existing[f] = Number(row[f]);
      }
      continue;
    }
    // New player or newer season.
    const entry = { player_id: row.player_id, player_name: row.player_name ?? "", season };
    for (const f of NUMERIC_FIELDS) {
      entry[f] = Number(row[f] ?? 0) || 0;
    }
    byPlayer.set(row.player_id, entry);
  }

  const output = { generatedAt: new Date().toISOString(), players: [...byPlayer.values()] };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${byPlayer.size} players → ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
