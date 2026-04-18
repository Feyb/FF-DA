import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatRadioChange, MatRadioModule } from "@angular/material/radio";
import { AppStore, DENSITY_SCALES } from "../../../core/state/app.store";

@Component({
  selector: "app-density-settings",
  templateUrl: "./density-settings.component.html",
  styleUrl: "./density-settings.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatRadioModule],
})
export class DensitySettingsComponent {
  protected readonly appStore = inject(AppStore);
  protected readonly densityOptions = DENSITY_SCALES;

  protected densityLabel(value: number): string {
    return value === 0 ? "Default" : `Compact ${value}`;
  }

  protected onDensityChange(event: MatRadioChange): void {
    this.appStore.setDensityScale(Number(event.value));
  }
}
