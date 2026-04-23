/**
 * Fetch ESPN public roster/depth-chart data for injury status and depth order.
 *
 * Sources (public ESPN JSON):
 *   https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/roster
 *
 * Output: src/assets/nflverse/espn-depth.json
 * Usage: node scripts/fetch-espn-rosters.mjs
 *
 * Note: ESPN does not have a gsis_id — we match by full_name + team.
 * The NflverseService resolves the final ID mapping at runtime.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../src/assets/nflverse");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "espn-depth.json");

// All 32 NFL team IDs (ESPN internal IDs, stable).
const TEAM_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 33, 34,
];

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTeam(teamId) {
  const url = `${BASE}/${teamId}/roster`;
  const res = await fetch(url, { headers: { "User-Agent": "FF-DA-ETL/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for team ${teamId}`);
  return res.json();
}

function extractPlayers(json) {
  const players = [];
  const roster = json?.athletes ?? [];
  for (const group of roster) {
    for (const athlete of group?.items ?? []) {
      players.push({
        espn_id: String(athlete.id ?? ""),
        full_name: athlete.fullName ?? athlete.displayName ?? "",
        position: athlete.position?.abbreviation ?? null,
        team_abbr: json?.team?.abbreviation ?? null,
        depth_chart_order: athlete.depthChartOrder ?? null,
        injury_status: athlete.injuries?.[0]?.type?.description ?? null,
        jersey: athlete.jersey ?? null,
      });
    }
  }
  return players;
}

async function main() {
  const allPlayers = [];
  for (const teamId of TEAM_IDS) {
    try {
      const json = await fetchTeam(teamId);
      allPlayers.push(...extractPlayers(json));
      await delay(200); // polite rate limit
    } catch (err) {
      console.warn(`Team ${teamId}: ${err.message}`);
    }
  }
  console.log(`Fetched ${allPlayers.length} ESPN roster entries`);

  const output = { generatedAt: new Date().toISOString(), players: allPlayers };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote → ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
