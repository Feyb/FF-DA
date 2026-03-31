#!/usr/bin/env node
/**
 * Fetch KeepTradeCut dynasty rankings and save as a static JSON asset.
 *
 * Runs during CI/CD before the Angular production build so the app can load
 * player rankings from a bundled asset instead of making a cross-origin
 * request to keeptradecut.com (which would be blocked by CORS on GitHub Pages).
 *
 * The raw `playersArray` structure includes both `oneQBValues` and
 * `superflexValues` for every player, so a single file covers both league types.
 *
 * Output: apps/draft-assistant/frontend/src/assets/ktc-rankings.json
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUTPUT_PATH = resolve(
  __dirname,
  '../apps/draft-assistant/frontend/src/assets/ktc-rankings.json',
);

const KTC_URL =
  'https://keeptradecut.com/dynasty-rankings?filters=QB|WR|RB|TE&format=1';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Locate `var playersArray = [...]` in the HTML and return the parsed array.
 * Uses bracket matching to safely extract the JSON without a full HTML parser.
 */
function extractPlayersArray(html) {
  const marker = 'var playersArray = ';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Marker "var playersArray" not found in page HTML.');
  }

  const arrayStart = html.indexOf('[', markerIndex);
  if (arrayStart === -1) {
    throw new Error('Opening bracket for playersArray not found.');
  }

  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('Matching closing bracket for playersArray not found.');
  }

  return JSON.parse(html.substring(arrayStart, arrayEnd + 1));
}

async function main() {
  console.log(`Fetching KTC rankings from:\n  ${KTC_URL}`);

  const response = await fetch(KTC_URL, { headers: FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const players = extractPlayersArray(html);

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(players));

  console.log(`✓ Saved ${players.length} players → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(`✗ Failed to fetch KTC rankings: ${err.message}`);
  // Write an empty array so the Angular build succeeds; the app will display
  // the "KTC unavailable" warning and fall back to Sleeper rankings.
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, '[]');
  console.warn('  Wrote empty player array – app will show KTC unavailable banner.');
});
