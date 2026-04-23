/**
 * Fetch nflverse Next Gen Stats and emit a slim JSON asset.
 *
 * Sources:
 *   passing:  nextgen_stats/ngs_passing.csv  → CPOE, xYAC_oe, avg_intended_air_yards
 *   rushing:  nextgen_stats/ngs_rushing.csv  → ryoe (rush yards over expected)
 *   receiving:nextgen_stats/ngs_receiving.csv→ avg_separation, avg_cushion, avg_intended_air_yards
 *
 * Output: src/assets/nflverse/ngs-stats.json
 * Usage: node scripts/fetch-nflverse-ngs.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "ngs-stats.json");

const BASE = "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats";
const ASSETS = [
  { url: `${BASE}/ngs_passing.csv`,   fields: ["player_gsis_id", "season", "cpoe", "avg_intended_air_yards", "passer_rating"] },
  { url: `${BASE}/ngs_rushing.csv`,   fields: ["player_gsis_id", "season", "rush_yards_over_expected_per_att"] },
  { url: `${BASE}/ngs_receiving.csv`, fields: ["player_gsis_id", "season", "avg_separation", "avg_cushion", "avg_intended_air_yards", "catch_percentage"] },
];

function parseCsv(text) {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

async function main() {
  const byPlayer = new Map();

  for (const asset of ASSETS) {
    try {
      const res = await fetch(asset.url);
      if (!res.ok) { console.warn(`Skip ${asset.url} (${res.status})`); continue; }
      const rows = parseCsv(await res.text());
      for (const row of rows) {
        const id = row["player_gsis_id"];
        if (!id) continue;
        const season = Number(row.season ?? 0);
        const existing = byPlayer.get(id);
        if (existing && existing.season > season) continue;
        const entry = (existing && existing.season === season) ? existing : { player_id: id, season };
        for (const f of asset.fields) {
          if (f !== "player_gsis_id" && f !== "season" && row[f] !== undefined && row[f] !== "") {
            entry[f] = Number(row[f]);
          }
        }
        byPlayer.set(id, entry);
      }
      console.log(`Processed ${asset.url}`);
    } catch (err) {
      console.warn(`Failed ${asset.url}: ${err.message}`);
    }
  }

  const output = { generatedAt: new Date().toISOString(), players: [...byPlayer.values()] };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${byPlayer.size} players → ${OUTPUT_FILE}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
