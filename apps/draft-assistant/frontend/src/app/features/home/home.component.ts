import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatListModule } from "@angular/material/list";
import { MatChipsModule } from "@angular/material/chips";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { MatIconModule } from "@angular/material/icon";
import { HomeStore } from "./home.store";
import { AppStore } from "../../core/state/app.store";
import { StorageService } from "../../core/services/storage.service";
import { League } from "../../core/models";
import { PageHeaderComponent } from "../../shared/components/page-header";
import { LoadingStateComponent } from "../../shared/components/loading-state";

const HOME_USERNAME_STORAGE_KEY = "draftAssistant.sleeperUsername";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HomeStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatIconModule,
    PageHeaderComponent,
    LoadingStateComponent,
  ],
})
export class HomeComponent {
  protected readonly store = inject(HomeStore);
  protected readonly appStore = inject(AppStore);
  private readonly storage = inject(StorageService);

  protected readonly usernameControl = new FormControl("");
  protected readonly leagueIdControl = new FormControl("");

  protected readonly seasonOptions: string[] = (() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = currentYear; y >= 2020; y--) {
      years.push(String(y));
    }
    return years;
  })();

  constructor() {
    const savedUsername = this.storage.getRawItem(HOME_USERNAME_STORAGE_KEY) ?? "";
    if (savedUsername) {
      this.usernameControl.setValue(savedUsername);
      this.store.loadByUsername(savedUsername);
    }
  }

  protected searchByUsername(): void {
    const val = this.usernameControl.value?.trim();
    if (!val) return;

    this.storage.setRawItem(HOME_USERNAME_STORAGE_KEY, val);
    this.store.loadByUsername(val);
  }

  protected searchByLeagueId(): void {
    const val = this.leagueIdControl.value?.trim();
    if (val) this.store.loadByLeagueId(val);
  }

  protected selectLeague(league: League): void {
    this.store.selectLeague(league);
  }

  protected onSeasonChange(season: string): void {
    this.store.setSelectedSeason(season);
    const username = this.storage.getRawItem(HOME_USERNAME_STORAGE_KEY);
    if (username) {
      this.store.loadByUsername(username);
    }
  }
}
