import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DraftStore } from "../draft.store";

interface CurveEntry {
  playerId: string;
  name: string;
  position: string;
  wcs: number;
  barPct: number;
  mcRate: number | null;
}

@Component({
  selector: "app-draft-strategy-curve",
  templateUrl: "./draft-strategy-curve.component.html",
  styleUrl: "./draft-strategy-curve.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class DraftStrategyCurveComponent {
  protected readonly store = inject(DraftStore);

  protected readonly curveEntries = computed((): CurveEntry[] => {
    const wcsMap = this.store.weightedCompositeByPlayer();
    const mcMap = this.store.mcConfidenceByPlayer();
    const draftedIds = new Set(this.store.picks().map((p) => p.player_id));
    const rows = this.store.enrichedRows();

    const undrafted = rows
      .filter((r) => !draftedIds.has(r.playerId) && (wcsMap.get(r.playerId) ?? null) !== null)
      .sort((a, b) => (wcsMap.get(b.playerId) ?? 0) - (wcsMap.get(a.playerId) ?? 0))
      .slice(0, 12);

    if (undrafted.length === 0) return [];

    const maxWcs = wcsMap.get(undrafted[0].playerId) ?? 1;

    return undrafted.map((row) => {
      const wcs = wcsMap.get(row.playerId) ?? 0;
      return {
        playerId: row.playerId,
        name: row.fullName,
        position: row.position,
        wcs: Math.round(wcs),
        barPct: maxWcs > 0 ? Math.round((wcs / maxWcs) * 100) : 0,
        mcRate: mcMap.get(row.playerId) ?? null,
      };
    });
  });
}
