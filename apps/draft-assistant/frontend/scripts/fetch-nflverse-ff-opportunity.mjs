/**
 * Fetch nflverse ff_opportunity data (xFP, weighted_opportunity).
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/ff_opportunity/ff_opportunity.csv
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
  "https://github.com/nflverse/nflverse-data/releases/download/ff_opportunity/ff_opportunity.csv";

const NUMERIC = ["season", "xfp", "weighted_opportunity", "wopr_y", "wopr_x", "racr"];

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
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = parseCsv(await res.text());

  const byPlayer = new Map();
  for (const row of rows) {
    if (!row.player_id) continue;
    const season = Number(row.season ?? 0);
    const existing = byPlayer.get(row.player_id);
    if (existing && existing.season > season) continue;
    if (existing && existing.season === season) {
      // Accumulate season totals.
      for (const f of ["xfp", "weighted_opportunity"]) {
        existing[f] = (existing[f] ?? 0) + (Number(row[f]) || 0);
      }
      continue;
    }
    const entry = { player_id: row.player_id, season };
    for (const f of NUMERIC) {
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
