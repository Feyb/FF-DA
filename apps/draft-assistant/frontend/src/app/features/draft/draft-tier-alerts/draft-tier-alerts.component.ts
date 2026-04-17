import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { DraftStore, TierDropAlert } from "../draft.store";

@Component({
  selector: "app-draft-tier-alerts",
  templateUrl: "./draft-tier-alerts.component.html",
  styleUrl: "./draft-tier-alerts.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class DraftTierAlertsComponent implements OnDestroy {
  protected readonly store = inject(DraftStore);

  private readonly _scheduledAlertIds = new Set<string>();
  private readonly _alertTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _tierAlertAutoDismiss = effect(() => {
    const alerts = this.store.tierDropAlerts();
    for (const alert of alerts) {
      if (this._scheduledAlertIds.has(alert.id)) continue;
      this._scheduledAlertIds.add(alert.id);
      const age = Date.now() - alert.createdAt;
      const delay = Math.max(0, 8000 - age);
      const handle = setTimeout(() => {
        this._scheduledAlertIds.delete(alert.id);
        this._alertTimeouts.delete(alert.id);
        this.store.dismissTierAlert(alert.id);
      }, delay);
      this._alertTimeouts.set(alert.id, handle);
    }
  });

  ngOnDestroy(): void {
    for (const handle of this._alertTimeouts.values()) {
      clearTimeout(handle);
    }
  }

  protected tierAlertLabel(alert: TierDropAlert): string {
    const pos = alert.position;
    const dropped = alert.droppedTier;
    if (alert.nextTier !== null) {
      return `Last Tier ${dropped} ${pos} drafted — Tier ${alert.nextTier} ${pos}s now available`;
    }
    return `Last Tier ${dropped} ${pos} drafted — no more ${pos}s in ranked tiers`;
  }

  protected dismissAlert(id: string): void {
    const handle = this._alertTimeouts.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this._alertTimeouts.delete(id);
    }
    this._scheduledAlertIds.delete(id);
    this.store.dismissTierAlert(id);
  }
}
