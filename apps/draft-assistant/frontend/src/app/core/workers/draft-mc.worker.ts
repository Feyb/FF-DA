/// <reference lib="webworker" />

/** Shared message types (also imported by DraftMcService). */

export interface McSimPlayer {
  playerId: string;
  adpMean: number | null;
  adpStd: number | null;
}

export interface McSimRequest {
  players: McSimPlayer[];
  currentPickNumber: number;
  userNextPickNumber: number;
  targetPlayerIds: string[];
  trials: number;
}

export interface McSimResult {
  confidence: { playerId: string; survivalRate: number }[];
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function normPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z);
}

/** Returns the sampled index, or -1 when all weights are zero. */
function weightedSampleIndex(weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function estimateSigma(adpMean: number): number {
  if (adpMean <= 24) return Math.max(1.5, adpMean / 8);
  if (adpMean <= 100) return Math.max(3, adpMean / 6);
  return Math.max(5, adpMean / 4);
}

// ── Simulation ────────────────────────────────────────────────────────────────

function runSimulation(req: McSimRequest): McSimResult {
  const { players, currentPickNumber, userNextPickNumber, targetPlayerIds, trials } = req;

  // Pre-cache sigmas and filter to players with ADP data.
  // Treat adpStd <= 0 or non-finite as missing to avoid division-by-zero in normPdf.
  const playerData: { id: string; mean: number; sigma: number }[] = players
    .filter((p) => p.adpMean !== null)
    .map((p) => ({
      id: p.playerId,
      mean: p.adpMean!,
      sigma:
        p.adpStd !== null && p.adpStd > 0 && isFinite(p.adpStd)
          ? p.adpStd
          : estimateSigma(p.adpMean!),
    }));

  // Precompute id→index map once so inner loops avoid O(n) indexOf scans.
  const idToIdx = new Map<string, number>(playerData.map((p, i) => [p.id, i]));
  const targetIndices = targetPlayerIds.map((id) => idToIdx.get(id) ?? -1);

  const survived = new Map<string, number>(targetPlayerIds.map((id) => [id, 0]));
  const picksToSimulate = userNextPickNumber - currentPickNumber - 1;

  for (let t = 0; t < trials; t++) {
    // Track available players using a boolean flag array (faster than Set removals).
    const available = Array.from<boolean>({ length: playerData.length }).fill(true);

    for (let pickOffset = 0; pickOffset < picksToSimulate; pickOffset++) {
      const pickN = currentPickNumber + 1 + pickOffset;

      // Compute unnormalised weights (Normal PDF at this pick number).
      const weights = playerData.map((p, i) =>
        available[i] ? normPdf(pickN, p.mean, p.sigma) : 0,
      );

      const idx = weightedSampleIndex(weights);
      if (idx >= 0) available[idx] = false;
    }

    // Check which target players survived to userNextPickNumber.
    for (let i = 0; i < targetPlayerIds.length; i++) {
      const idx = targetIndices[i];
      if (idx < 0 || available[idx]) {
        const id = targetPlayerIds[i];
        survived.set(id, (survived.get(id) ?? 0) + 1);
      }
    }
  }

  const confidence = targetPlayerIds.map((playerId) => ({
    playerId,
    survivalRate: (survived.get(playerId) ?? 0) / trials,
  }));

  return { confidence };
}

// ── Worker message handler ────────────────────────────────────────────────────

addEventListener("message", (event: MessageEvent<McSimRequest>) => {
  const result = runSimulation(event.data);
  postMessage(result);
});
