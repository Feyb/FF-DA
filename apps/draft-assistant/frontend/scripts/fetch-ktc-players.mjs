import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KTC_RANKINGS_URL = 'https://keeptradecut.com/dynasty-rankings';
const OUTPUT_DIR = resolve(__dirname, '../src/assets/ktc');

const FORMATS = [
  { key: '1qb', format: 1, output: 'players-1qb.json' },
  { key: 'superflex', format: 2, output: 'players-superflex.json' },
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function extractPlayersArray(html) {
  const marker = 'var playersArray = ';
  const start = html.indexOf(marker);
  if (start === -1) {
    throw new Error('playersArray marker not found in KTC response');
  }

  const arrayStart = html.indexOf('[', start);
  if (arrayStart === -1) {
    throw new Error('playersArray JSON start not found in KTC response');
  }

  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('playersArray JSON end not found in KTC response');
  }

  return JSON.parse(html.slice(arrayStart, arrayEnd + 1));
}

function mapPlayers(rawPlayers, isSuperflex) {
  return rawPlayers.map((player) => {
    const values = isSuperflex ? player.superflexValues : player.oneQBValues;
    return {
      playerName: player.playerName,
      playerID: player.playerID,
      slug: player.slug,
      position: player.position,
      positionID: player.positionID,
      team: player.team,
      rookie: player.rookie,
      age: player.age,
      value: values?.value ?? 0,
      rank: values?.rank ?? 0,
      positionalRank: values?.positionalRank ?? 0,
      overallTier: values?.overallTier ?? 0,
      positionalTier: values?.positionalTier ?? 0,
    };
  });
}

async function fetchWithRetry(url, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'ff-draft-assistant-cache-sync/1.0',
          accept: 'text/html,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const metadata = {
    source: 'keeptradecut.com',
    generatedAt: new Date().toISOString(),
    formats: {},
  };

  for (const formatConfig of FORMATS) {
    const url = `${KTC_RANKINGS_URL}?filters=QB|WR|RB|TE&format=${formatConfig.format}`;
    const html = await fetchWithRetry(url);
    const rawPlayers = extractPlayersArray(html);
    const players = mapPlayers(rawPlayers, formatConfig.key === 'superflex');
    const outputPath = resolve(OUTPUT_DIR, formatConfig.output);
    await writeJsonFile(outputPath, players);

    metadata.formats[formatConfig.key] = {
      count: players.length,
      output: formatConfig.output,
      url,
    };

    console.log(`[ktc-sync] wrote ${players.length} players to ${outputPath}`);
  }

  const metadataPath = resolve(OUTPUT_DIR, 'metadata.json');
  await writeJsonFile(metadataPath, metadata);
  console.log(`[ktc-sync] wrote metadata to ${metadataPath}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ktc-sync] failed: ${message}`);
  process.exitCode = 1;
});
