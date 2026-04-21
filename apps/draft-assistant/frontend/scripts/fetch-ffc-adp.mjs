/**
 * Fetch FantasyFootballCalculator ADP (with stddev / hi / lo / times_drafted)
 * and write them as bundled static assets.
 *
 * Usage:
 *   node ./scripts/fetch-ffc-adp.mjs
 *
 * Environment variables:
 *   FFC_YEAR          – Season year (default: current year).
 *   FFC_TEAMS         – League size (default: 12).
 *   FFC_SYNC_STRICT   – "true" to fail on errors (default: false).
 *
 * API endpoint: https://fantasyfootballcalculator.com/api/v1/adp/{format}
 *   format: half-ppr | ppr | standard | dynasty | rookie | superflex | 2qb
 *   query : ?teams=12&year={Y}
 *
 * The API is keyless and free; we mirror it nightly into bundled JSON to avoid
 * runtime CORS issues and keep the SPA fully static.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, "../src/assets/ffc");
const YEAR = process.env.FFC_YEAR ?? String(new Date().getFullYear());
const TEAMS = process.env.FFC_TEAMS ?? "12";
const STRICT = (process.env.FFC_SYNC_STRICT ?? "false").toLowerCase() === "true";

const BASE_URL = "https://fantasyfootballcalculator.com/api/v1/adp";

const FORMATS = [
  { key: "half-ppr", output: "adp-half-ppr-12team.json", path: "half-ppr" },
  { key: "ppr", output: "adp-ppr-12team.json", path: "ppr" },
  { key: "standard", output: "adp-standard-12team.json", path: "standard" },
  { key: "superflex", output: "adp-superflex-12team.json", path: "superflex" },
  { key: "dynasty", output: "adp-dynasty-12team.json", path: "dynasty" },
  { key: "rookie", output: "adp-rookie-12team.json", path: "rookie" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

/**
 * Map a raw FFC entry to the slim shape consumed by the app.
 *
 * API response shape:
 * {
 *   "status": "Success",
 *   "meta": { "type", "scoring", "teams", "total_drafts" },
 *   "players": [
 *     { "player_id", "name", "position", "team", "adp", "adp_formatted",
 *       "times_drafted", "high", "low", "stdev", "bye" }
 *   ]
 * }
 */
function mapPlayers(rawPlayers) {
  if (!Array.isArray(rawPlayers)) return [];
  return rawPlayers
    .filter((p) => p?.name && typeof p.adp === "number")
    .map((p) => ({
      playerName: p.name,
      position: p.position ?? "",
      team: p.team ?? null,
      adp: p.adp,
      adpFormatted: p.adp_formatted ?? null,
      stdev: typeof p.stdev === "number" ? p.stdev : null,
      high: typeof p.high === "number" ? p.high : null,
      low: typeof p.low === "number" ? p.low : null,
      timesDrafted: typeof p.times_drafted === "number" ? p.times_drafted : null,
      bye: typeof p.bye === "number" ? p.bye : null,
    }));
}

async function fetchFormat(formatConfig) {
  const url = `${BASE_URL}/${formatConfig.path}?teams=${encodeURIComponent(TEAMS)}&year=${encodeURIComponent(YEAR)}`;
  const response = await fetchWithRetry(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ff-draft-assistant-ffc-sync/1.0",
    },
  });
  const json = await response.json();
  return { players: mapPlayers(json?.players), meta: json?.meta ?? null, url };
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const metadata = {
    source: "fantasyfootballcalculator.com",
    generatedAt: new Date().toISOString(),
    year: YEAR,
    teams: TEAMS,
    formats: {},
  };

  const errors = [];

  for (const formatConfig of FORMATS) {
    try {
      const { players, meta, url } = await fetchFormat(formatConfig);
      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, players);

      metadata.formats[formatConfig.key] = {
        output: formatConfig.output,
        count: players.length,
        url,
        meta,
      };

      console.log(`[ffc-sync] wrote ${players.length} players to ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ffc-sync] failed format "${formatConfig.key}": ${message}`);
      errors.push({ key: formatConfig.key, error: message });
      if (STRICT) throw error;

      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, []);
    }
  }

  await writeJsonFile(resolve(OUTPUT_DIR, "metadata.json"), metadata);

  if (errors.length > 0) {
    console.error(
      `[ffc-sync] ${errors.length} format(s) failed: ${errors.map((e) => `${e.key}: ${e.error}`).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ffc-sync] failed: ${message}`);
  process.exitCode = 1;
});
