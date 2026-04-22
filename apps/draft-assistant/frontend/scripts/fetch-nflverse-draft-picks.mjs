/**
 * Fetch nflverse draft_picks data (NFL draft round/pick per player).
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv
 * Output: src/assets/nflverse/draft-picks.json
 * Usage: node scripts/fetch-nflverse-draft-picks.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "draft-picks.json");

const URL =
  "https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv";

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
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = parseCsv(await res.text());

  // Key by gsis_id (nflverse player ID); keep most recent draft year per player.
  const byPlayer = new Map();
  for (const row of rows) {
    const id = row.gsis_id ?? row.player_id;
    if (!id) continue;
    const season = Number(row.season ?? 0);
    const existing = byPlayer.get(id);
    if (existing && existing.season >= season) continue;
    byPlayer.set(id, {
      player_id: id,
      season,
      round: Number(row.round) || null,
      pick: Number(row.pick) || null,
      position: row.position ?? null,
    });
  }

  const output = { generatedAt: new Date().toISOString(), players: [...byPlayer.values()] };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${byPlayer.size} players → ${OUTPUT_FILE}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
