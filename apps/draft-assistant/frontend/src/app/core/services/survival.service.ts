import { Injectable } from "@angular/core";

/**
 * Survival probability and ADP-distribution math used by the Weighted
 * Composite Score board-state stage.
 *
 * Treat each player's ADP as Normal(mean = adpMean, sd = adpStd) — the
 * universal industry approximation (DraftKick, FanGraphs/Zimmerman, FFA).
 * The Normal CDF is computed via the Abramowitz-Stegun 7.1.26 approximation
 * to erf (max error 1.5e-7), which is ~9 FLOPs per call and trivial at the
 * 1 Hz draft-poll cadence.
 */
@Injectable({ providedIn: "root" })
export class SurvivalService {
  /** Standard normal CDF Phi(z). A&S 7.1.26 erf approximation. */
  normalCdf(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.SQRT2));
  }

  /** A&S 7.1.26: max abs error 1.5e-7. */
  erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * ax);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  /**
   * Probability the player has been taken by the time pick number `pickN` is
   * made (i.e. on pick `<= pickN`). Uses the +0.5 continuity correction so the
   * discrete pick number is treated as the centre of a unit interval.
   */
  pTakenBy(pickN: number, adpMean: number, adpStd: number): number {
    if (
      !Number.isFinite(pickN) ||
      !Number.isFinite(adpMean) ||
      !Number.isFinite(adpStd) ||
      adpStd <= 0
    ) {
      return 0;
    }
    return this.normalCdf((pickN + 0.5 - adpMean) / adpStd);
  }

  /**
   * Probability the player is still on the board AT pick `pickN` (i.e. they
   * have not been taken by pick number `pickN - 1`).
   */
  pAvailableAt(pickN: number, adpMean: number, adpStd: number): number {
    if (
      !Number.isFinite(pickN) ||
      !Number.isFinite(adpMean) ||
      !Number.isFinite(adpStd) ||
      adpStd <= 0
    ) {
      return 1;
    }
    return 1 - this.normalCdf((pickN - 0.5 - adpMean) / adpStd);
  }

  /**
   * Heuristic stddev fallback for when FFC times_drafted < threshold. Calibrated
   * loosely from DraftKick's published rules of thumb: variance grows with ADP
   * but tapers off in deeper rounds where consensus thins out.
   */
  estimateSigma(adpMean: number): number {
    if (!Number.isFinite(adpMean) || adpMean <= 0) return 12;
    if (adpMean <= 24) return Math.max(1.5, adpMean / 8);
    if (adpMean <= 100) return Math.max(3, adpMean / 6);
    return Math.max(5, adpMean / 4);
  }
}
