import { Pipe, PipeTransform } from "@angular/core";

export function getTierColorClass(tier: number | null): string {
  if (tier === null) return "tier-unranked";
  const tierNum = Math.max(1, Math.min(tier, 10));
  const cycledTier = ((tierNum - 1) % 10) + 1;
  return `tier-${cycledTier}`;
}

@Pipe({ name: "tierColor" })
export class TierColorPipe implements PipeTransform {
  transform(tier: number | null): string {
    return getTierColorClass(tier);
  }
}
