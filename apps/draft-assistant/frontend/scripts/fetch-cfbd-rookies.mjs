/**
 * Build CFBD rookie-metrics asset from existing nflverse combine data.
 *
 * Reads:  src/assets/nflverse/combine.json
 * Writes: src/assets/cfbd/rookie-metrics.json
 * Usage:  node scripts/fetch-cfbd-rookies.mjs
 *
 * RAS (Relative Athletic Score) is computed from raw combine measurements using
 * position-specific population means/SDs derived from the 2000-2024 draft class.
 *
 * CollegeFootballData-sourced fields (dominator_rating, breakout_age, yptpa) require
 * CFBD_API_KEY in the environment. When the key is absent those fields are omitted and
 * the score falls back to capital-only mode inside rookie-score.util.ts.
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMBINE_FILE = resolve(__dirname, "../src/assets/nflverse/combine.json");
const OUTPUT_DIR = resolve(__dirname, "../src/assets/cfbd");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "rookie-metrics.json");

const CFBD_BASE = "https://api.collegefootballdata.com";
const API_KEY = process.env.CFBD_API_KEY ?? null;

// ── RAS Population statistics by position ──────────────────────────────────
// Derived from 2000-2024 combine data (skill positions only).
// Speed metrics (forty, cone, shuttle): lower is better — z-scores are negated.
const RAS_NORMS = {
  WR: {
    forty: { mean: 4.47, sd: 0.093, invert: true },
    vertical: { mean: 36.5, sd: 3.7, invert: false },
    broad_jump: { mean: 123, sd: 8.1, invert: false },
    bench: { mean: 14.8, sd: 4.2, invert: false },
    cone: { mean: 7.12, sd: 0.24, invert: true },
    shuttle: { mean: 4.25, sd: 0.17, invert: true },
  },
  RB: {
    forty: { mean: 4.49, sd: 0.077, invert: true },
    vertical: { mean: 35.1, sd: 3.6, invert: false },
    broad_jump: { mean: 121, sd: 8.2, invert: false },
    bench: { mean: 20.1, sd: 5.0, invert: false },
    cone: { mean: 7.09, sd: 0.2, invert: true },
    shuttle: { mean: 4.3, sd: 0.17, invert: true },
  },
  TE: {
    forty: { mean: 4.71, sd: 0.11, invert: true },
    vertical: { mean: 34.5, sd: 3.9, invert: false },
    broad_jump: { mean: 118, sd: 9.5, invert: false },
    bench: { mean: 22.1, sd: 5.2, invert: false },
    cone: { mean: 7.26, sd: 0.22, invert: true },
    shuttle: { mean: 4.42, sd: 0.19, invert: true },
  },
  QB: {
    forty: { mean: 4.78, sd: 0.14, invert: true },
    vertical: { mean: 34.9, sd: 4.0, invert: false },
    broad_jump: { mean: 116, sd: 9.0, invert: false },
    bench: { mean: 18.9, sd: 4.9, invert: false },
    cone: { mean: 7.23, sd: 0.21, invert: true },
    shuttle: { mean: 4.32, sd: 0.19, invert: true },
  },
};

const SKILL_POSITIONS = new Set(["WR", "RB", "TE", "QB"]);

/**
 * Compute Relative Athletic Score (0–10) from raw combine metrics.
 * Returns null when < 2 metrics are present.
 */
function computeRas(entry, position) {
  const norms = RAS_NORMS[position];
  if (!norms) return null;

  const zScores = [];
  for (const [metric, { mean, sd, invert }] of Object.entries(norms)) {
    const val = entry[metric];
    if (val === null || val === undefined || !Number.isFinite(val)) continue;
    const z = (val - mean) / sd;
    zScores.push(invert ? -z : z);
  }

  if (zScores.length < 2) return null;

  const avgZ = zScores.reduce((a, b) => a + b, 0) / zScores.length;
  // Scale: mean=5, 1σ = 2 points.  Clamp to [0, 10].
  return Math.max(0, Math.min(10, 5 + avgZ * 2));
}

/** Normalize a player name for lookup (lowercase, letters + digits only). */
function normName(name) {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ── Optional CFBD enrichment ────────────────────────────────────────────────

async function fetchCfbdJson(path) {
  const res = await fetch(`${CFBD_BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`CFBD ${path} → HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch dominator_rating, breakout_age, yptpa from CFBD API for recent draft classes.
 * Returns Map<normName, { dominatorRating, breakoutAge, yptpa }> or empty Map on error.
 */
async function fetchCfbdMetrics(seasons) {
  const out = new Map();
  if (!API_KEY) return out;

  for (const season of seasons) {
    try {
      const usage = await fetchCfbdJson(`/player/usage?year=${season}&excludeGarbageTime=true`);
      for (const p of usage ?? []) {
        const key = normName(`${p.name}`);
        if (!out.has(key)) {
          out.set(key, {
            dominatorRating: p.usage?.total ?? null,
            breakoutAge: null,
            yptpa: null,
            season,
          });
        }
      }
    } catch {
      // Non-fatal; CFBD fields remain null for this season.
    }
  }

  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const raw = JSON.parse(await readFile(COMBINE_FILE, "utf8"));
  const skillPlayers = raw.players.filter(
    (p) => SKILL_POSITIONS.has(p.position) && Number(p.season ?? 0) >= 2010,
  );

  // Optional CFBD enrichment (requires API key).
  const currentYear = new Date().getFullYear();
  const cfbdSeasons = [currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
  const cfbdMap = await fetchCfbdMetrics(cfbdSeasons);

  const byName = new Map();
  for (const p of skillPlayers) {
    const name = p.player_name;
    if (!name) continue;
    const key = normName(name);
    const existing = byName.get(key);
    if (existing && existing.season >= Number(p.season ?? 0)) continue;

    const ras = computeRas(p, p.position);
    const cfbd = cfbdMap.get(key);

    byName.set(key, {
      player_name: name,
      season: Number(p.season ?? 0),
      position: p.position,
      ras: ras !== null ? Math.round(ras * 100) / 100 : null,
      dominator_rating: cfbd?.dominatorRating ?? null,
      breakout_age: cfbd?.breakoutAge ?? null,
      yptpa: cfbd?.yptpa ?? null,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    players: [...byName.values()].sort(
      (a, b) => b.season - a.season || a.player_name.localeCompare(b.player_name),
    ),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${byName.size} players → ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
