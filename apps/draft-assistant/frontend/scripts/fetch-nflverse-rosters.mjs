/**
 * Fetch nflverse rosters data (birth_date, years_exp, depth chart).
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/rosters/roster_*.csv
 * Output: src/assets/nflverse/rosters.json
 * Usage: node scripts/fetch-nflverse-rosters.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "rosters.json");

const CURRENT_YEAR = new Date().getFullYear();
const BASE = "https://github.com/nflverse/nflverse-data/releases/download/rosters";
// Try current and prior year.
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1];

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
  const byPlayer = new Map();

  for (const year of YEARS) {
    const url = `${BASE}/roster_${year}.csv`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Skip ${url} (${res.status})`);
        continue;
      }
      const rows = parseCsv(await res.text());
      for (const row of rows) {
        const id = row.gsis_id;
        if (!id) continue;
        // More recent year wins.
        const season = Number(row.season ?? year);
        const existing = byPlayer.get(id);
        if (existing && existing.season >= season) continue;
        byPlayer.set(id, {
          player_id: id,
          full_name: row.full_name ?? "",
          birth_date: row.birth_date ?? null,
          years_exp: row.years_exp !== "" ? Number(row.years_exp) : null,
          position: row.position ?? null,
          team: row.team ?? null,
          status: row.status ?? null,
          depth_chart_position: row.depth_chart_position ?? null,
          depth_chart_order: row.depth_chart_order !== "" ? Number(row.depth_chart_order) : null,
          season,
        });
      }
      console.log(`Processed ${url}`);
    } catch (err) {
      console.warn(`Failed ${url}: ${err.message}`);
    }
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
