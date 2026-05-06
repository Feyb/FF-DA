/**
 * Fetch nflverse combine data (athletic testing).
 *
 * Source: github.com/nflverse/nflverse-data/releases/download/combine/combine.csv
 * Output: src/assets/nflverse/combine.json
 * Usage: node scripts/fetch-nflverse-combine.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "combine.json");

const URL = "https://github.com/nflverse/nflverse-data/releases/download/combine/combine.csv";

const NUMERIC = ["forty", "vertical", "broad_jump", "bench", "cone", "shuttle", "season"];

function makeFallbackId(row) {
  const season = row.season ?? row.draft_year ?? "unknown";
  const name = (row.player_name ?? "unknown")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const school = (row.school ?? "unknown")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `combine:${season}:${name}:${school}`;
}

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
    const id = row.gsis_id ?? row.player_id ?? row.pfr_id ?? row.cfb_id ?? makeFallbackId(row);
    if (!id) continue;
    // Keep most recent combine season per player.
    const season = Number(row.season ?? row.draft_year ?? 0);
    const existing = byPlayer.get(id);
    if (existing && existing.season >= season) continue;
    const entry = {
      player_id: id,
      player_name: row.player_name ?? "",
      position: row.pos ?? row.position ?? null,
      season,
    };
    for (const f of NUMERIC) {
      const rawValue = row[f];
      const v =
        rawValue === "" || rawValue === undefined || rawValue === null ? NaN : Number(rawValue);
      entry[f] = Number.isFinite(v) ? v : null;
    }
    byPlayer.set(id, entry);
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
