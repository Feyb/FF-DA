/**
 * Fetch Sleeper per-player season stats and write them as bundled static assets.
 *
 * Usage:
 *   node ./scripts/fetch-sleeper-stats.mjs
 *
 * Environment variables:
 *   STATS_YEAR   – NFL season year to fetch (default: previous calendar year).
 *
 * Fetches the Sleeper bulk weekly stats endpoint for every regular-season week
 * (weeks 1–18).  All numeric stat fields are summed across weeks per player.
 * `snap_pct` is averaged (not summed) across weeks where the player had snaps.
 *
 * Output files:
 *   src/assets/sleeper-stats/players-{YEAR}.json  – per-player season totals
 *   src/assets/sleeper-stats/metadata.json        – run metadata
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, "../src/assets/sleeper-stats");

// Default to the previous calendar year (last completed NFL season).
const defaultYear = String(new Date().getFullYear() - 1);
const YEAR = process.env.STATS_YEAR ?? defaultYear;
const REGULAR_SEASON_WEEKS = 18;

/** Stat fields to track. snap_pct is averaged, all others are summed. */
const STAT_FIELDS = [
  "pass_yd",
  "pass_td",
  "pass_int",
  "pass_cmp",
  "pass_att",
  "rush_yd",
  "rush_td",
  "rush_att",
  "rec_yd",
  "rec_td",
  "rec",
  "tar",
  "yac",
  "rec_drop",
  "snap_pct",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = 500 * (attempt + 1);
        console.warn(
          `[sleeper-stats] attempt ${attempt + 1} failed for ${url}: ${error.message} — retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

async function fetchWeekStats(year, week) {
  const url = `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${week}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();
  return data ?? {};
}

/**
 * Merge a single week's stats into the running totals map.
 *
 * @param {Map<string, { totals: Record<string, number>; snapWeeks: number }>} totalsMap
 * @param {Record<string, Record<string, number>>} weekData
 */
function mergeWeekStats(totalsMap, weekData) {
  for (const [playerId, stats] of Object.entries(weekData)) {
    if (!playerId || !stats || typeof stats !== "object") continue;

    let entry = totalsMap.get(playerId);
    if (!entry) {
      entry = { totals: Object.fromEntries(STAT_FIELDS.map((f) => [f, 0])), snapWeeks: 0 };
      totalsMap.set(playerId, entry);
    }

    for (const field of STAT_FIELDS) {
      const value = stats[field];
      if (typeof value !== "number") continue;

      if (field === "snap_pct") {
        // snap_pct is accumulated into a running sum so we can average at the end.
        // snapWeeks tracks how many weeks the player had snap data.
        entry.totals["snap_pct"] += value;
        entry.snapWeeks += 1;
      } else {
        entry.totals[field] += value;
      }
    }
  }
}

function buildOutputStats(totalsMap) {
  const output = {};

  for (const [playerId, { totals, snapWeeks }] of totalsMap.entries()) {
    const playerStats = { ...totals };

    // Average snap_pct across weeks with snap data; 0 if no snap data at all.
    playerStats["snap_pct"] =
      snapWeeks > 0 ? Math.round((totals["snap_pct"] / snapWeeks) * 1000) / 1000 : 0;

    // Round all values to reasonable precision.
    for (const field of STAT_FIELDS) {
      if (field !== "snap_pct") {
        playerStats[field] = Math.round(playerStats[field]);
      }
    }

    output[playerId] = playerStats;
  }

  return output;
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`[sleeper-stats] fetching ${YEAR} season stats (weeks 1–${REGULAR_SEASON_WEEKS})…`);

  const totalsMap = new Map();
  let successfulWeeks = 0;
  const errors = [];

  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
    try {
      const weekData = await fetchWeekStats(YEAR, week);
      const playerCount = Object.keys(weekData).length;

      if (playerCount === 0) {
        console.warn(`[sleeper-stats] week ${week}: empty response — skipping`);
      } else {
        mergeWeekStats(totalsMap, weekData);
        successfulWeeks += 1;
        console.log(`[sleeper-stats] week ${week}: merged ${playerCount} players`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[sleeper-stats] week ${week} failed: ${message}`);
      errors.push({ week, error: message });
    }

    // Small delay between requests to be a polite API client.
    if (week < REGULAR_SEASON_WEEKS) {
      await sleep(150);
    }
  }

  const outputStats = buildOutputStats(totalsMap);
  const playerCount = Object.keys(outputStats).length;

  const statsPath = resolve(OUTPUT_DIR, `players-${YEAR}.json`);
  await writeJsonFile(statsPath, outputStats);
  console.log(`[sleeper-stats] wrote ${playerCount} players to ${statsPath}`);

  const metadata = {
    source: "sleeper.app",
    generatedAt: new Date().toISOString(),
    year: YEAR,
    weekCount: successfulWeeks,
    playerCount,
  };

  if (errors.length > 0) {
    metadata["errors"] = errors;
  }

  const metadataPath = resolve(OUTPUT_DIR, "metadata.json");
  await writeJsonFile(metadataPath, metadata);
  console.log(`[sleeper-stats] wrote metadata to ${metadataPath}`);

  if (errors.length > 0) {
    console.warn(
      `[sleeper-stats] ${errors.length} week(s) failed: ${errors.map((e) => `week ${e.week}`).join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`[sleeper-stats] done — ${successfulWeeks} weeks, ${playerCount} players`);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sleeper-stats] fatal: ${message}`);
  process.exitCode = 1;
});
