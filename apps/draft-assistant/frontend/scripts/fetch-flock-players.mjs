import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, '../src/assets/flock');
const ENV_FILE = resolve(__dirname, '../.env.local');

const YEAR = process.env.FLOCK_YEAR ?? '2025';
const STRICT = (process.env.FLOCK_SYNC_STRICT ?? 'false').toLowerCase() === 'true';

const FORMATS = [
  {
    key: '1qb',
    output: 'players-1qb.json',
    url:
      'https://api.flockfantasy.com/rankings?format=ONEQB&pickType=hybrid&year=' +
      encodeURIComponent(YEAR) +
      '&deltaRankType=overall&deltaFormat=DYNASTY&deltaSubformat=1QB',
  },
  {
    key: 'superflex',
    output: 'players-superflex.json',
    url:
      'https://api.flockfantasy.com/rankings?format=SUPERFLEX&pickType=hybrid&year=' +
      encodeURIComponent(YEAR) +
      '&deltaRankType=overall&deltaFormat=DYNASTY&deltaSubformat=SUPERFLEX',
  },
  {
    key: 'rookies-1qb',
    output: 'players-rookies-1qb.json',
    url:
      'https://api.flockfantasy.com/rankings?format=PROSPECTS&pickType=hybrid&year=' +
      encodeURIComponent(YEAR) +
      '&deltaRankType=overall&deltaFormat=DYNASTY&deltaSubformat=1QB',
  },
  {
    key: 'rookies-sf',
    output: 'players-rookies-sf.json',
    url:
      'https://api.flockfantasy.com/rankings?format=PROSPECTS_SF&pickType=hybrid&year=' +
      encodeURIComponent(YEAR) +
      '&deltaRankType=overall&deltaFormat=DYNASTY&deltaSubformat=SUPERFLEX',
  },
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

async function loadLocalEnv() {
  try {
    const content = await readFile(ENV_FILE, 'utf8');
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

function getConfig(localEnv) {
  const email = process.env.FLOCK_EMAIL ?? localEnv.FLOCK_EMAIL ?? '';
  const password = process.env.FLOCK_PASSWORD ?? localEnv.FLOCK_PASSWORD ?? '';
  const sessionCookie = process.env.FLOCK_SESSION_COOKIE ?? localEnv.FLOCK_SESSION_COOKIE ?? '';
  const loginUrl =
    process.env.FLOCK_LOGIN_URL ?? localEnv.FLOCK_LOGIN_URL ?? 'https://flockfantasy.com/api/auth/login';

  return { email, password, sessionCookie, loginUrl };
}

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

async function loginAndGetCookie(config) {
  if (!config.email || !config.password) {
    return null;
  }

  const baseHeaders = {
    accept: 'application/json,text/plain,*/*',
    'user-agent': 'ff-draft-assistant-flock-sync/1.0',
  };

  try {
    const response = await fetchWithRetry(
      config.loginUrl,
      {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: config.email, password: config.password }),
      },
      1,
    );

    const cookie = response.headers.get('set-cookie');
    if (cookie) return cookie;
  } catch {
    // Fall through to form login attempt.
  }

  const body = new URLSearchParams();
  body.set('email', config.email);
  body.set('password', config.password);

  try {
    const response = await fetchWithRetry(
      config.loginUrl,
      {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
      1,
    );

    return response.headers.get('set-cookie');
  } catch {
    return null;
  }
}

async function fetchRankings(url, cookieHeader) {
  const headers = {
    accept: 'application/json,text/plain,*/*',
    'user-agent': 'ff-draft-assistant-flock-sync/1.0',
  };

  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const response = await fetchWithRetry(url, { headers });
  return response.json();
}

async function writeJsonFile(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function run() {
  const localEnv = await loadLocalEnv();
  const config = getConfig(localEnv);

  try {
    await mkdir(OUTPUT_DIR, { recursive: true });

    let cookieHeader = '';
    if (config.sessionCookie) {
      cookieHeader = config.sessionCookie;
    } else {
      const cookieFromLogin = await loginAndGetCookie(config);
      if (cookieFromLogin) {
        cookieHeader = cookieFromLogin;
      }
    }

    if (!cookieHeader && STRICT) {
      throw new Error('Flock credentials are missing. Set FLOCK_SESSION_COOKIE or FLOCK_EMAIL/FLOCK_PASSWORD.');
    }

    const metadataPath = resolve(OUTPUT_DIR, 'metadata.json');
    const metadata = {
      source: 'flockfantasy.com',
      generatedAt: new Date().toISOString(),
      formats: {},
    };

    const errors = [];

    for (const formatConfig of FORMATS) {
      try {
        const data = await fetchRankings(formatConfig.url, cookieHeader);
        const playersPath = resolve(OUTPUT_DIR, formatConfig.output);
        await writeJsonFile(playersPath, data);

        metadata.formats[formatConfig.key] = {
          output: formatConfig.output,
          count: Array.isArray(data?.data) ? data.data.length : null,
          url: formatConfig.url,
        };

        const count = Array.isArray(data?.data) ? data.data.length : 'unknown';
        console.log(`[flock-sync] wrote ${count} players to ${playersPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[flock-sync] failed to fetch format "${formatConfig.key}": ${message}`);
        errors.push({ key: formatConfig.key, error: message });
        if (STRICT) {
          throw error;
        }
      }
    }

    await writeJsonFile(metadataPath, {
      ...metadata,
    });

    if (errors.length > 0) {
      console.error(`[flock-sync] ${errors.length} format(s) failed: ${errors.map((e) => `${e.key}: ${e.error}`).join(', ')}`);
      process.exitCode = 1;
    }
  } catch (error) {
    if (STRICT) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[flock-sync] skipped: ${message}`);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[flock-sync] failed: ${message}`);
  process.exitCode = 1;
});
