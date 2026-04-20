import { Injectable } from "@angular/core";

/**
 * One ranking source's value for a single player. Either a `rank` (lower =
 * better) or a `value` (higher = better) — never both. The aggregator handles
 * the polarity flip for ranks internally.
 */
export interface SourceObservation {
  source: string;
  rank?: number;
  value?: number;
}

/**
 * Per-player input: which sources observed this player. The aggregator
 * z-scores within each (source, position) bucket so that, say, a top-3 KTC
 * RB is comparable to a top-3 Flock WR before blending.
 */
export interface ConsensusInput {
  playerId: string;
  position: string;
  sources: SourceObservation[];
}

/** Per-player output. */
export interface ConsensusOutput {
  playerId: string;
  /** 0-100 rescaled score; null if no source observed this player. */
  baseValue: number | null;
  /** sd of the per-source z-scores feeding this player; surfaces ranker disagreement. */
  divergence: number | null;
  /** number of sources that contributed (post-trim). */
  contributingSources: number;
}

export interface AggregateOptions {
  /**
   * Per-source weights. Sources missing for a player are dropped and the
   * remaining weights are renormalized; missing sources do NOT contribute zero.
   */
  weights: Record<string, number>;
  /** Trim the min and max source z-score per player when at least this many sources observed them (default: 4). */
  trimMinSources?: number;
}

/**
 * Aggregate multiple ranking/value sources into a single 0-100 BaseValue per
 * player using a weighted, position-normalized, trimmed z-mean.
 *
 * Algorithm (per the WCS design doc, Stage 1):
 *   1. For each (source, position), compute mean and population sd of the raw
 *      observations. Convert each observation to a z-score.
 *      - For rank sources, negate so higher z = better.
 *      - For value sources, keep sign (higher value already = better).
 *   2. For each player with >= trimMinSources observations, drop the min and
 *      max z to defuse a single rogue source.
 *   3. Take the weight-renormalized mean of the surviving z-scores -> z*.
 *   4. Min-max rescale z* across all players to [0, 100] -> baseValue.
 *
 * The min-max rescale (vs logistic sigmoid) is chosen because it preserves
 * interpretable 0-100 units for the UI: BaseValue 100 = best player in the
 * pool by aggregated consensus, 0 = worst.
 */
@Injectable({ providedIn: "root" })
export class ConsensusAggregatorService {
  aggregate(inputs: ConsensusInput[], options: AggregateOptions): Map<string, ConsensusOutput> {
    const trimMin = options.trimMinSources ?? 4;
    const result = new Map<string, ConsensusOutput>();

    // Stage 1a: collect raw observations bucketed by (source, position).
    type BucketKey = string;
    const bucketKey = (source: string, position: string): BucketKey => `${source}|${position}`;

    const buckets = new Map<BucketKey, { kind: "rank" | "value"; values: number[] }>();

    for (const input of inputs) {
      for (const obs of input.sources) {
        const key = bucketKey(obs.source, input.position);
        const raw = obs.rank ?? obs.value;
        if (raw === undefined || !Number.isFinite(raw)) continue;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { kind: obs.rank !== undefined ? "rank" : "value", values: [] };
          buckets.set(key, bucket);
        }
        bucket.values.push(raw);
      }
    }

    // Stage 1b: compute mean and population sd per bucket.
    interface BucketStats {
      kind: "rank" | "value";
      mean: number;
      sd: number;
    }
    const stats = new Map<BucketKey, BucketStats>();
    for (const [key, bucket] of buckets) {
      const n = bucket.values.length;
      if (n === 0) continue;
      const mean = bucket.values.reduce((s, v) => s + v, 0) / n;
      const variance = bucket.values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const sd = Math.sqrt(variance);
      stats.set(key, { kind: bucket.kind, mean, sd });
    }

    // Stage 2-3: per-player z-scores -> trimmed weighted mean.
    interface RawAggregate {
      playerId: string;
      zStar: number | null;
      divergence: number | null;
      contributing: number;
    }
    const raws: RawAggregate[] = [];

    for (const input of inputs) {
      const zEntries: { source: string; z: number; weight: number }[] = [];

      for (const obs of input.sources) {
        const key = bucketKey(obs.source, input.position);
        const stat = stats.get(key);
        if (!stat || stat.sd === 0) continue;

        const raw = obs.rank ?? obs.value;
        if (raw === undefined || !Number.isFinite(raw)) continue;

        const weight = options.weights[obs.source] ?? 0;
        if (weight <= 0) continue;

        let z = (raw - stat.mean) / stat.sd;
        if (stat.kind === "rank") z = -z;

        zEntries.push({ source: obs.source, z, weight });
      }

      if (zEntries.length === 0) {
        raws.push({ playerId: input.playerId, zStar: null, divergence: null, contributing: 0 });
        continue;
      }

      // Compute divergence over all entries before trimming, so the UI signal
      // reflects true ranker disagreement.
      const allZs = zEntries.map((e) => e.z);
      const allMean = allZs.reduce((s, v) => s + v, 0) / allZs.length;
      const allVar = allZs.reduce((s, v) => s + (v - allMean) ** 2, 0) / allZs.length;
      const divergence = Math.sqrt(allVar);

      // Trim the single min and single max if we have enough sources.
      let surviving = zEntries;
      if (zEntries.length >= trimMin) {
        const sorted = [...zEntries].sort((a, b) => a.z - b.z);
        surviving = sorted.slice(1, -1);
      }

      const totalWeight = surviving.reduce((s, e) => s + e.weight, 0);
      if (totalWeight <= 0) {
        raws.push({ playerId: input.playerId, zStar: null, divergence: null, contributing: 0 });
        continue;
      }
      const zStar = surviving.reduce((s, e) => s + (e.z * e.weight) / totalWeight, 0);

      raws.push({
        playerId: input.playerId,
        zStar,
        divergence,
        contributing: surviving.length,
      });
    }

    // Stage 4: min-max rescale zStar to [0, 100].
    const finiteZs = raws.map((r) => r.zStar).filter((z): z is number => z !== null);
    const zMin = finiteZs.length > 0 ? Math.min(...finiteZs) : 0;
    const zMax = finiteZs.length > 0 ? Math.max(...finiteZs) : 0;
    const range = zMax - zMin;

    for (const raw of raws) {
      const baseValue =
        raw.zStar === null ? null : range > 0 ? ((raw.zStar - zMin) / range) * 100 : 50;
      result.set(raw.playerId, {
        playerId: raw.playerId,
        baseValue,
        divergence: raw.divergence,
        contributingSources: raw.contributing,
      });
    }

    return result;
  }
}
