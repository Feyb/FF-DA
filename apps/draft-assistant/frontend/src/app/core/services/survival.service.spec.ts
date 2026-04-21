/// <reference types="jasmine" />

import { TestBed } from "@angular/core/testing";
import { SurvivalService } from "./survival.service";

describe("SurvivalService", () => {
  let service: SurvivalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SurvivalService);
  });

  describe("normalCdf", () => {
    // Reference values from scipy.stats.norm.cdf (double precision).
    const cases: [number, number][] = [
      [-3, 0.0013498980316301035],
      [-2, 0.022750131948179195],
      [-1.96, 0.024997895148220435],
      [-1, 0.15865525393145707],
      [-0.5, 0.3085375387259869],
      [0, 0.5],
      [0.5, 0.6914624612740131],
      [1, 0.8413447460685429],
      [1.96, 0.9750021048517795],
      [2, 0.9772498680518208],
      [3, 0.9986501019683699],
    ];

    for (const [z, expected] of cases) {
      it(`Phi(${z}) ~= ${expected}`, () => {
        expect(service.normalCdf(z)).toBeCloseTo(expected, 5);
      });
    }
  });

  describe("pAvailableAt / pTakenBy", () => {
    it("are complementary at any pickN", () => {
      const mean = 24;
      const std = 4;
      for (const pickN of [10, 20, 24, 28, 40]) {
        const sum = service.pTakenBy(pickN, mean, std) + service.pAvailableAt(pickN + 1, mean, std);
        expect(sum).toBeCloseTo(1, 5);
      }
    });

    it("returns ~50% when pickN equals adpMean (continuity-aware)", () => {
      const p = service.pAvailableAt(24, 24, 4);
      expect(p).toBeGreaterThan(0.45);
      expect(p).toBeLessThan(0.6);
    });

    it("returns near-1 when pickN is many sigmas before mean", () => {
      expect(service.pAvailableAt(1, 50, 5)).toBeGreaterThan(0.99999);
    });

    it("returns near-0 when pickN is many sigmas after mean", () => {
      expect(service.pAvailableAt(100, 20, 5)).toBeLessThan(0.0001);
    });

    it("falls back to pAvailable=1 for invalid stddev", () => {
      expect(service.pAvailableAt(10, 5, 0)).toBe(1);
      expect(service.pAvailableAt(10, 5, NaN)).toBe(1);
    });
  });

  describe("estimateSigma", () => {
    it("scales sigma roughly with ADP", () => {
      expect(service.estimateSigma(8)).toBe(1.5);
      expect(service.estimateSigma(60)).toBe(10);
      expect(service.estimateSigma(150)).toBe(37.5);
    });

    it("clamps to a sensible floor for unknown ADP", () => {
      expect(service.estimateSigma(NaN)).toBe(12);
      expect(service.estimateSigma(0)).toBe(12);
    });
  });
});
