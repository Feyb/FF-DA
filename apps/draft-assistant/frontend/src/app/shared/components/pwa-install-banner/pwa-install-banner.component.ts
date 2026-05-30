import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

const DISMISSED_KEY = "pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

@Component({
  selector: "app-pwa-install-banner",
  templateUrl: "./pwa-install-banner.component.html",
  styleUrl: "./pwa-install-banner.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
})
export class PwaInstallBannerComponent implements OnInit {
  protected readonly visible = signal(false);
  protected readonly isIos = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  ngOnInit(): void {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return;

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    this.isIos.set(ios);

    if (ios) {
      this.visible.set(true);
      return;
    }

    window.addEventListener("beforeinstallprompt", (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.visible.set(true);
    });
  }

  protected async install(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    if (outcome === "accepted") this.dismiss();
    else this.visible.set(false);
  }

  protected dismiss(): void {
    localStorage.setItem(DISMISSED_KEY, "1");
    this.visible.set(false);
  }
}
