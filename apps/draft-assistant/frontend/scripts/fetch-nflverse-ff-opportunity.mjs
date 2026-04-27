/**
 * Derive ff_opportunity metrics from player_stats_season.csv.
 *
 * The nflverse ff_opportunity release (ff_opportunity.csv) was deprecated;
 * weighted_opportunity is now computed as the industry-standard approximation:
 *   weighted_opportunity = 0.5 × carries + targets   (Scott Barrett formula)
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_season.csv
 * Output: src/assets/nflverse/ff-opportunity.json
 * Usage: node scripts/fetch-nflverse-ff-opportunity.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "ff-opportunity.json");

const URL =
  "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_season.csv";

function parseCsv(text) {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      return row;
    });
}

async function main() {
  console.log(`Fetching ${URL}…`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = parseCsv(await res.text());

  // Keep only regular-season rows; pick the most recent season per player.
  const byPlayer = new Map();
  for (const row of rows) {
    if (!row.player_id) continue;
    if ((row.season_type ?? "REG") !== "REG") continue;

    const season = Number(row.season ?? 0);
    const existing = byPlayer.get(row.player_id);
    if (existing && existing.season > season) continue;

    const carries = Number(row.carries ?? 0) || 0;
    const targets = Number(row.targets ?? 0) || 0;
    const wopr = Number(row.wopr ?? 0) || 0;
    const xfp = Number(row.fantasy_points_ppr ?? 0) || 0;

    byPlayer.set(row.player_id, {
      player_id: row.player_id,
      season,
      // Standard industry approximation: 0.5 × carries + targets
      weighted_opportunity: 0.5 * carries + targets,
      // season-level WOPR (same field as player_stats weekly average)
      wopr_y: wopr,
      wopr_x: wopr,
      racr: Number(row.racr ?? 0) || 0,
      xfp,
    });
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
