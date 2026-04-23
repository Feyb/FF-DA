/**
 * Fetch nflverse pfr_advstats seasonal data and emit a slim JSON asset.
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/pfr_advstats/pfr_advstats_season_*.csv
 * Output: src/assets/nflverse/pfr-advstats.json
 *
 * Fields extracted (most recent season per player):
 *   player_id, season, routes, yprr (yards per route run), tprr (targets per route run),
 *   ybc_a (yards before contact per attempt), yac_a (yards after contact per attempt),
 *   broken_tackles, drop_pct
 *
 * Usage: node scripts/fetch-nflverse-pfr-advstats.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "pfr-advstats.json");

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR];
const BASE = "https://github.com/nflverse/nflverse-data/releases/download/pfr_advstats";

const FIELDS = ["routes", "yprr", "tprr", "ybc_a", "yac_a", "broken_tackles", "drop_pct"];

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
    for (const suffix of ["rec", "rush", "pass"]) {
      const url = `${BASE}/pfr_advstats_season_${suffix}_${year}.csv`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Skip ${url} (${res.status})`);
          continue;
        }
        const rows = parseCsv(await res.text());
        for (const row of rows) {
          if (!row.player_id) continue;
          const season = Number(row.season ?? year);
          const existing = byPlayer.get(row.player_id);
          if (existing && existing.season > season) continue;
          const entry =
            existing && existing.season === season
              ? existing
              : { player_id: row.player_id, season };
          for (const f of FIELDS) {
            if (row[f] !== undefined && row[f] !== "") entry[f] = Number(row[f]);
          }
          byPlayer.set(row.player_id, entry);
        }
        console.log(`Processed ${url}`);
      } catch (err) {
        console.warn(`Failed ${url}: ${err.message}`);
      }
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
