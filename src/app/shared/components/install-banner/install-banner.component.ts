import { Component, signal, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-install-banner',
  standalone: true,
  template: `
    @if (show()) {
      <div class="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 md:hidden animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-dark-800 border border-primary-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-2xl shadow-black/30">
          <div class="w-11 h-11 rounded-xl bg-primary-900 border border-primary-500/30 flex items-center justify-center flex-shrink-0 text-xl">
            🎵
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-ink leading-tight">Instalar BandYou</p>
            <p class="text-xs text-ink-muted mt-0.5">Acceso rápido desde tu pantalla de inicio</p>
          </div>
          <button (click)="install()"
            class="flex-shrink-0 px-3 py-2 bg-primary-500 hover:bg-primary-400 text-white text-xs font-bold rounded-xl transition-colors">
            Instalar
          </button>
          <button (click)="dismiss()"
            class="flex-shrink-0 p-1.5 text-ink-muted hover:text-ink transition-colors rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
