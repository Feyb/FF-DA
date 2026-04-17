/// <reference types="jasmine" />

import { adpDeltaClass, adpDeltaLabel, sortSourceRankLabel } from "./draft-display.util";

describe("draft-display.util", () => {
  it("maps sort sources to the expected display labels", () => {
    expect(sortSourceRankLabel("combinedTier")).toBe("Comb. Tier");
    expect(sortSourceRankLabel("sleeperRank")).toBe("Sleeper Rank");
    expect(sortSourceRankLabel("ktcRank")).toBe("KTC Rank");
    expect(sortSourceRankLabel("flockRank")).toBe("Flock Rank");
    expect(sortSourceRankLabel("combinedPositionalTier")).toBe("Comb. Pos. Tier");
    expect(sortSourceRankLabel("adpDelta")).toBe("ADP Delta");
    expect(sortSourceRankLabel("valueGap")).toBe("Value Gap");
    expect(sortSourceRankLabel("fpAdpRank")).toBe("FP ADP");
  });

  it("formats adp delta labels", () => {
    expect(adpDeltaLabel(null)).toBe("—");
    expect(adpDeltaLabel(3)).toBe("+3");
    expect(adpDeltaLabel(-2)).toBe("-2");
    expect(adpDeltaLabel(0)).toBe("0");
  });

  it("returns adp delta classes by threshold", () => {
    expect(adpDeltaClass(null)).toBe("");
    expect(adpDeltaClass(2)).toBe("adp-value");
    expect(adpDeltaClass(-2)).toBe("adp-reach");
    expect(adpDeltaClass(1)).toBe("adp-neutral");
    expect(adpDeltaClass(0)).toBe("adp-neutral");
  });
});
