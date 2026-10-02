import { Component, signal, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-install-banner',
  standalone: true,
  template: `
    @if (show()) {
      <div class="fixed bottom-above-nav left-0 right-0 z-40 px-4 pb-2 md:hidden animate-slide-in">
        <div class="bg-dark-800 border-2 border-ink p-4 flex items-center gap-3 shadow-[4px_4px_0_0_#141210]">
          <div class="w-11 h-11 bg-poster-yellow border-2 border-ink flex items-center justify-center flex-shrink-0 text-xl">
            🎵
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-display text-xl uppercase text-ink leading-tight">Instalar BandYou</p>
            <p class="text-xs text-ink-2 mt-0.5">Recibe notificaciones de mensajes aunque tengas la app cerrada</p>
          </div>
          <button (click)="install()"
            class="btn-primary flex-shrink-0 px-4 text-xs min-h-[44px]">
            Instalar
          </button>
          <button (click)="dismiss()"
            type="button" aria-label="Cerrar banner de instalación"
            class="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink hover:text-primary-600 transition-colors">
            <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class InstallBannerComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  show = signal(false);
  private deferredPrompt: any = null;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (localStorage.getItem('pwa-install-dismissed')) return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      // Small delay so it doesn't appear immediately on page load
      setTimeout(() => this.show.set(true), 3000);
    });

    window.addEventListener('appinstalled', () => {
      this.show.set(false);
      this.deferredPrompt = null;
    });
  }

  install() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      this.show.set(false);
    });
  }

  dismiss() {
    this.show.set(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }
}
