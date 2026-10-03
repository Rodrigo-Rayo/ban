import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { bannerWants, showInstallBanner } from '../cookie-banner/banner-queue';

const DISMISSED_KEY = 'pwa-install-dismissed';

@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (show()) {
      <div class="fixed bottom-above-nav left-0 right-0 z-40 px-4 pb-2 md:hidden animate-slide-in">
        <div class="bg-dark-800 border-2 border-ink p-4 flex items-center gap-3 shadow-[4px_4px_0_0_#141210]">
          <div class="w-11 h-11 bg-poster-yellow border-2 border-ink flex items-center justify-center flex-shrink-0 ">
            <app-icon name="music" [size]="22"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-display text-xl uppercase text-ink leading-tight">Instalar BandYou</p>
            <p class="text-xs text-ink-2 mt-0.5">Recibe notificaciones de mensajes aunque tengas la app cerrada</p>
          </div>
          <button (click)="install()" type="button"
            class="btn-primary flex-shrink-0 px-4 text-xs min-h-[44px]">
            Instalar
          </button>
          <button (click)="dismiss()"
            type="button" aria-label="Cerrar banner de instalación"
            class="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink hover:text-primary-600 transition-colors">
            <app-icon name="x" [size]="16"/>
          </button>
        </div>
      </div>
    }
  `,
})
export class InstallBannerComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);

  /** Visible only when the cookie and notification notices are not showing. */
  readonly show = showInstallBanner;
  private deferredPrompt: any = null;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    try { if (localStorage.getItem(DISMISSED_KEY)) return; } catch { return; }

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      // Small delay so it doesn't appear immediately on page load
      setTimeout(() => bannerWants.install.set(true), 3000);
    });

    window.addEventListener('appinstalled', () => {
      bannerWants.install.set(false);
      this.deferredPrompt = null;
    });
  }

  ngOnDestroy() {
    bannerWants.install.set(false);
  }

  install() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      bannerWants.install.set(false);
    });
  }

  dismiss() {
    bannerWants.install.set(false);
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch { /* storage unavailable */ }
  }
}
