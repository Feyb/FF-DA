/**
 * Fetch FantasyPros dynasty ADP rankings and write them as bundled static assets.
 *
 * Usage:
 *   FANTASYPROS_API_KEY=<key> node ./scripts/fetch-fantasypros-adp.mjs
 *
 * Environment variables:
 *   FANTASYPROS_API_KEY   – FantasyPros partner API key (required for live data).
 *   FP_YEAR               – Season year to fetch (default: current year).
 *   FP_SYNC_STRICT        – Set to "true" to fail on missing credentials (default: false).
 *
 * When FANTASYPROS_API_KEY is absent the script writes empty arrays and exits
 * with code 0 so the build still succeeds for contributors without an API key.
 *
 * API endpoint: https://api.fantasypros.com/v2/json/nfl/{YEAR}/dynasty/adp
 *   Required header: x-api-key: <FANTASYPROS_API_KEY>
 *   Optional query params: scoring (STANDARD | HALF | PPR), numberOfTeams, position
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, '../src/assets/fantasypros');
const YEAR = process.env.FP_YEAR ?? String(new Date().getFullYear());
const STRICT = (process.env.FP_SYNC_STRICT ?? 'false').toLowerCase() === 'true';
const API_KEY = process.env.FANTASYPROS_API_KEY ?? '';

const BASE_URL = `https://api.fantasypros.com/v2/json/nfl/${YEAR}/dynasty/adp`;

const FORMATS = [
  {
    key: '1qb',
    output: 'players-1qb.json',
    params: new URLSearchParams({ scoring: 'HALF', position: 'ALL', numberOfTeams: '12' }),
  },
  {
    key: 'superflex',
    output: 'players-superflex.json',
    params: new URLSearchParams({ scoring: 'SF_HALF', position: 'ALL', numberOfTeams: '12' }),
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * Map a raw FantasyPros player entry to the normalised shape expected by the
 * FantasyProsAdpService / PlayerNormalizationService.
 *
 * The API response shape:
 * {
 *   "players": [
 *     {
 *       "player_id": 19988,
 *       "player_name": "Justin Jefferson",
 *       "player_team_id": "MIN",
 *       "player_position_id": "WR",
 *       "adp": 1.05,
 *       "adp_formatted": "1.05"
 *     }
 *   ]
 * }
 */
function mapPlayers(rawPlayers) {
  // Sort by raw ADP ascending, then assign sequential integer ranks (1-based).
  // Sequential re-ranking is intentional: it normalises fractional ADP values
  // (e.g. 1.05, 2.67) to clean ordinal integers and is consistent with how
  // KTC/Flock ranks are stored. Players without a numeric adp are excluded.
  return rawPlayers
    .filter((p) => p.player_name && typeof p.adp === 'number')
    .sort((a, b) => a.adp - b.adp)
    .map((p, index) => ({
      playerName: p.player_name,
      position: p.player_position_id ?? '',
      team: p.player_team_id ?? null,
      adpRank: index + 1,
    }));
}

async function fetchRankings(formatConfig) {
  const url = `${BASE_URL}?${formatConfig.params.toString()}`;
  const response = await fetchWithRetry(url, {
    headers: {
      'x-api-key': API_KEY,
      accept: 'application/json',
      'user-agent': 'ff-draft-assistant-fp-sync/1.0',
    },
  });
  const json = await response.json();
  const rawPlayers = Array.isArray(json?.players) ? json.players : [];
  return mapPlayers(rawPlayers);
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (!API_KEY) {
    if (STRICT) {
      throw new Error(
        'FANTASYPROS_API_KEY is not set. Set the env var to fetch live FantasyPros ADP data.',
      );
    }

    console.warn(
      '[fp-sync] FANTASYPROS_API_KEY is not set — writing empty placeholder files. ' +
        'Set FANTASYPROS_API_KEY to fetch live data.',
    );

    for (const formatConfig of FORMATS) {
      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, []);
      console.log(`[fp-sync] wrote empty placeholder to ${outputPath}`);
    }

    return;
  }

  const metadata = {
    source: 'fantasypros.com',
    generatedAt: new Date().toISOString(),
    year: YEAR,
    formats: {},
  };

  const errors = [];

  for (const formatConfig of FORMATS) {
    try {
      const players = await fetchRankings(formatConfig);
      const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
      await writeJsonFile(outputPath, players);

      metadata.formats[formatConfig.key] = {
        output: formatConfig.output,
        count: players.length,
        url: `${BASE_URL}?${formatConfig.params.toString()}`,
      };

      console.log(`[fp-sync] wrote ${players.length} players to ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fp-sync] failed to fetch format "${formatConfig.key}": ${message}`);
      errors.push({ key: formatConfig.key, error: message });
      if (STRICT) {
        throw error;
      }
    }
  }

  const metadataPath = resolve(OUTPUT_DIR, 'metadata.json');
  await writeJsonFile(metadataPath, metadata);
  console.log(`[fp-sync] wrote metadata to ${metadataPath}`);

  if (errors.length > 0) {
    console.error(
      `[fp-sync] ${errors.length} format(s) failed: ${errors.map((e) => `${e.key}: ${e.error}`).join(', ')}`,
    );
    process.exitCode = 1;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fp-sync] failed: ${message}`);
  process.exitCode = 1;
});
