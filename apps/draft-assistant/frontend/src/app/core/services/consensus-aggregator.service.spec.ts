/// <reference types="jasmine" />

import { TestBed } from "@angular/core/testing";
import { ConsensusAggregatorService, ConsensusInput } from "./consensus-aggregator.service";

describe("ConsensusAggregatorService", () => {
  let service: ConsensusAggregatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConsensusAggregatorService);
  });

  it("returns null baseValue when no source observed the player", () => {
    const out = service.aggregate([{ playerId: "ghost", position: "WR", sources: [] }], {
      weights: { ktc: 1 },
    });
    expect(out.get("ghost")?.baseValue).toBeNull();
    expect(out.get("ghost")?.contributingSources).toBe(0);
  });

  it("ranks the consensus #1 player at baseValue 100 and consensus last at 0", () => {
    const inputs: ConsensusInput[] = [
      {
        playerId: "a",
        position: "WR",
        sources: [
          { source: "ktc", rank: 1 },
          { source: "fp", rank: 1 },
        ],
      },
      {
        playerId: "b",
        position: "WR",
        sources: [
          { source: "ktc", rank: 2 },
          { source: "fp", rank: 2 },
        ],
      },
      {
        playerId: "c",
        position: "WR",
        sources: [
          { source: "ktc", rank: 3 },
          { source: "fp", rank: 3 },
        ],
      },
    ];
    const out = service.aggregate(inputs, { weights: { ktc: 0.5, fp: 0.5 } });
    expect(out.get("a")?.baseValue).toBeCloseTo(100, 5);
    expect(out.get("c")?.baseValue).toBeCloseTo(0, 5);
    expect(out.get("b")?.baseValue).toBeCloseTo(50, 5);
  });

  it("treats value-scale sources (higher = better) and rank-scale sources symmetrically", () => {
    const inputs: ConsensusInput[] = [
      {
        playerId: "a",
        position: "WR",
        sources: [
          { source: "ktc", value: 9000 },
          { source: "fp", rank: 1 },
        ],
      },
      {
        playerId: "b",
        position: "WR",
        sources: [
          { source: "ktc", value: 7000 },
          { source: "fp", rank: 2 },
        ],
      },
      {
        playerId: "c",
        position: "WR",
        sources: [
          { source: "ktc", value: 5000 },
          { source: "fp", rank: 3 },
        ],
      },
    ];
    const out = service.aggregate(inputs, { weights: { ktc: 0.5, fp: 0.5 } });
    expect(out.get("a")?.baseValue).toBeCloseTo(100, 5);
    expect(out.get("c")?.baseValue).toBeCloseTo(0, 5);
  });

  it("normalizes within position so a top-3 RB can match a top-3 WR", () => {
    const inputs: ConsensusInput[] = [
      { playerId: "wr1", position: "WR", sources: [{ source: "fp", rank: 1 }] },
      { playerId: "wr2", position: "WR", sources: [{ source: "fp", rank: 2 }] },
      { playerId: "wr3", position: "WR", sources: [{ source: "fp", rank: 3 }] },
      { playerId: "rb1", position: "RB", sources: [{ source: "fp", rank: 1 }] },
      { playerId: "rb2", position: "RB", sources: [{ source: "fp", rank: 2 }] },
      { playerId: "rb3", position: "RB", sources: [{ source: "fp", rank: 3 }] },
    ];
    const out = service.aggregate(inputs, { weights: { fp: 1 } });
    expect(out.get("wr1")?.baseValue).toBeCloseTo(out.get("rb1")?.baseValue ?? -1, 5);
    expect(out.get("wr3")?.baseValue).toBeCloseTo(out.get("rb3")?.baseValue ?? -1, 5);
  });

  it("trims the single min and single max source z when at least 4 sources observed", () => {
    // 4 sources rank player A consistently top, but one outlier source ranks them last.
    // With trimming, the outlier is dropped and A's baseValue should still be high.
    const inputs: ConsensusInput[] = [
      {
        playerId: "a",
        position: "WR",
        sources: [
          { source: "s1", rank: 1 },
          { source: "s2", rank: 1 },
          { source: "s3", rank: 1 },
          { source: "s4", rank: 5 }, // outlier (will be trimmed as max-rank, i.e. min-z)
        ],
      },
      {
        playerId: "b",
        position: "WR",
        sources: [
          { source: "s1", rank: 2 },
          { source: "s2", rank: 2 },
          { source: "s3", rank: 2 },
          { source: "s4", rank: 2 },
        ],
      },
      {
        playerId: "c",
        position: "WR",
        sources: [
          { source: "s1", rank: 3 },
          { source: "s2", rank: 3 },
          { source: "s3", rank: 3 },
          { source: "s4", rank: 3 },
        ],
      },
      {
        playerId: "d",
        position: "WR",
        sources: [
          { source: "s1", rank: 4 },
          { source: "s2", rank: 4 },
          { source: "s3", rank: 4 },
          { source: "s4", rank: 4 },
        ],
      },
      {
        playerId: "e",
        position: "WR",
        sources: [
          { source: "s1", rank: 5 },
          { source: "s2", rank: 5 },
          { source: "s3", rank: 5 },
          { source: "s4", rank: 1 }, // counter-outlier so trimming is symmetric
        ],
      },
    ];
    const weights = { s1: 0.25, s2: 0.25, s3: 0.25, s4: 0.25 };
    const out = service.aggregate(inputs, { weights });
    // Player A should still be among the top.
    expect(out.get("a")?.baseValue).toBeGreaterThan(out.get("c")?.baseValue ?? 0);
    // Trimming reported only the surviving sources for A (4 - 2 = 2).
    expect(out.get("a")?.contributingSources).toBe(2);
  });

  it("renormalizes weights when a source is missing for a player", () => {
    // Two sources, equal weight. Player A only has one source; that source's
    // signal should drive A's baseValue without zero-padding.
    const inputs: ConsensusInput[] = [
      {
        playerId: "a",
        position: "WR",
        sources: [{ source: "ktc", rank: 1 }],
      },
      {
        playerId: "b",
        position: "WR",
        sources: [
          { source: "ktc", rank: 2 },
          { source: "fp", rank: 1 },
        ],
      },
      {
        playerId: "c",
        position: "WR",
        sources: [
          { source: "ktc", rank: 3 },
          { source: "fp", rank: 2 },
        ],
      },
    ];
    const out = service.aggregate(inputs, { weights: { ktc: 0.5, fp: 0.5 } });
    expect(out.get("a")?.contributingSources).toBe(1);
    expect(out.get("a")?.baseValue).toBeCloseTo(100, 5); // best rank in single source
  });

  it("reports divergence as the sd of per-source z-scores before trim", () => {
    const inputs: ConsensusInput[] = [
      {
        playerId: "split",
        position: "WR",
        sources: [
          { source: "ktc", rank: 1 },
          { source: "fp", rank: 5 },
        ],
      },
      {
        playerId: "agreed",
        position: "WR",
        sources: [
          { source: "ktc", rank: 2 },
          { source: "fp", rank: 2 },
        ],
      },
      {
        playerId: "consistent",
        position: "WR",
        sources: [
          { source: "ktc", rank: 3 },
          { source: "fp", rank: 3 },
        ],
      },
      {
        playerId: "filler",
        position: "WR",
        sources: [
          { source: "ktc", rank: 4 },
          { source: "fp", rank: 4 },
        ],
      },
      {
        playerId: "tail",
        position: "WR",
        sources: [
          { source: "ktc", rank: 5 },
          { source: "fp", rank: 1 },
        ],
      },
    ];
    const out = service.aggregate(inputs, { weights: { ktc: 0.5, fp: 0.5 } });
    expect(out.get("split")?.divergence).toBeGreaterThan(out.get("agreed")?.divergence ?? 0);
  });
});
