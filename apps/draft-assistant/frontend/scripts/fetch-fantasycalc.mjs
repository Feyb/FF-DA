/**
 * Fetch FantasyCalc crowdsourced player values and write them as bundled
 * static assets.
 *
 * Usage:
 *   node ./scripts/fetch-fantasycalc.mjs
 *
 * Environment variables:
 *   FC_SYNC_STRICT   – Set to "true" to fail on any fetch error (default: false).
 *
 * API endpoint: https://api.fantasycalc.com/values/current
 *   Query params:
 *     isDynasty        – true | false
 *     numQbs           – 1 | 2  (1 = 1QB, 2 = Superflex)
 *     numTeams         – integer (12 default)
 *     ppr              – 0 | 0.5 | 1
 *
 * The API is keyless and rate-limit-friendly for low-frequency build syncs.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, "../src/assets/fantasycalc");
const STRICT = (process.env.FC_SYNC_STRICT ?? "false").toLowerCase() === "true";

const BASE_URL = "https://api.fantasycalc.com/values/current";

const FORMATS = [
  {
    key: "1qb-dynasty",
    output: "values-1qb-dynasty.json",
    params: { isDynasty: "true", numQbs: "1", numTeams: "12", ppr: "0.5" },
  },
  {
    key: "superflex-dynasty",
    output: "values-superflex-dynasty.json",
    params: { isDynasty: "true", numQbs: "2", numTeams: "12", ppr: "0.5" },
  },
  {
    key: "1qb-redraft",
    output: "values-1qb-redraft.json",
    params: { isDynasty: "false", numQbs: "1", numTeams: "12", ppr: "0.5" },
  },
  {
    key: "superflex-redraft",
    output: "values-superflex-redraft.json",
    params: { isDynasty: "false", numQbs: "2", numTeams: "12", ppr: "0.5" },
  },
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
 * Map a raw FantasyCalc entry to the slim shape the app consumes.
 * API response shape (per entry):
 * {
 *   "player": { "id", "name", "mflId", "sleeperId", "position", "maybeBirthday", "maybeAge", "maybeYoe", "espnId", "fleaflickerId" },
 *   "value": 9821,
 *   "overallRank": 1,
 *   "positionRank": 1,
 *   "trend30Day": 124,
 *   "redraftValue": 4023,
 *   "combinedValue": 13844,
 *   "maybeMovingStandardDeviation": 312,
 *   "maybeMovingStandardDeviationPerc": 0.032,
 *   "displayTrend": true,
 *   "starter": true,
 *   "maybeOwner": null,
 *   "redraftDynastyValueDifference": 5798
 * }
 */
function mapPlayers(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries
    .filter((entry) => entry?.player?.name && typeof entry.value === "number")
    .map((entry) => ({
      playerName: entry.player.name,
      sleeperId: entry.player.sleeperId ?? null,
      position: entry.player.position ?? "",
      value: entry.value,
      overallRank: typeof entry.overallRank === "number" ? entry.overallRank : null,
      positionRank: typeof entry.positionRank === "number" ? entry.positionRank : null,
      trend30Day: typeof entry.trend30Day === "number" ? entry.trend30Day : null,
      redraftValue: typeof entry.redraftValue === "number" ? entry.redraftValue : null,
      combinedValue: typeof entry.combinedValue === "number" ? entry.combinedValue : null,
      stdev:
        typeof entry.maybeMovingStandardDeviation === "number"
          ? entry.maybeMovingStandardDeviation
          : null,
    }));
}

async function fetchFormat(formatConfig) {
  const params = new URLSearchParams(formatConfig.params);
  const url = `${BASE_URL}?${params.toString()}`;
  const response = await fetchWithRetry(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ff-draft-assistant-fc-sync/1.0",
    },
  });
  const json = await response.json();
  return mapPlayers(json);
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const metadata = {
    source: "api.fantasycalc.com",
    generatedAt: new Date().toISOString(),
    formats: {},
  };

  const errors = [];

  for (const formatConfig of FORMATS) {
    try {
      const players = await fetchFormat(formatConfig);
      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, players);

      metadata.formats[formatConfig.key] = {
        output: formatConfig.output,
        count: players.length,
        params: formatConfig.params,
      };

      console.log(`[fc-sync] wrote ${players.length} players to ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fc-sync] failed format "${formatConfig.key}": ${message}`);
      errors.push({ key: formatConfig.key, error: message });
      if (STRICT) throw error;

      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, []);
    }
  }

  await writeJsonFile(resolve(OUTPUT_DIR, "metadata.json"), metadata);

  if (errors.length > 0) {
    console.error(
      `[fc-sync] ${errors.length} format(s) failed: ${errors.map((e) => `${e.key}: ${e.error}`).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fc-sync] failed: ${message}`);
  process.exitCode = 1;
});
