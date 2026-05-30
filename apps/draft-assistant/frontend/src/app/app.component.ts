import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AppNavComponent } from "./shared/components/app-nav";
import { BottomNavComponent } from "./shared/components/bottom-nav";
import { PwaInstallBannerComponent } from "./shared/components/pwa-install-banner";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppNavComponent, BottomNavComponent, PwaInstallBannerComponent],
})
export class AppComponent {}
