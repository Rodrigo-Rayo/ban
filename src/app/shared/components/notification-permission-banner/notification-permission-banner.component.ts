import { Component, signal, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';

const DISMISSED_KEY = 'notif-permission-dismissed';

@Component({
  selector: 'app-notification-permission-banner',
  standalone: true,
  template: `
    @if (show()) {
      <div class="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 lg:bottom-4 animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-dark-800 border border-primary-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-2xl shadow-black/40 max-w-sm md:ml-auto md:mr-4">
          <div class="w-10 h-10 rounded-xl bg-primary-900 border border-primary-500/30 flex items-center justify-center flex-shrink-0 text-lg">
            🔔
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-ink leading-tight">Activa las notificaciones</p>
            @if (error()) {
              <p class="text-xs text-signal-red mt-0.5 leading-snug" role="alert">No se pudieron activar. Inténtalo de nuevo.</p>
            } @else {
              <p class="text-xs text-ink-muted mt-0.5 leading-snug">Recibe tus mensajes aunque tengas la app cerrada</p>
            }
          </div>
          <div class="flex flex-col gap-1.5 flex-shrink-0">
            <button (click)="activate()"
              [disabled]="loading()"
              class="px-3 py-2 bg-primary-500 hover:bg-primary-400 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap min-h-[44px]">
              {{ loading() ? 'Activando…' : 'Activar' }}
            </button>
            <button (click)="dismiss()"
              class="px-3 py-2 text-ink-muted hover:text-ink text-xs rounded-xl transition-colors whitespace-nowrap min-h-[44px]">
              Ahora no
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NotificationPermissionBannerComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private push = inject(PushNotificationService);

  show = signal(false);
  loading = signal(false);
  error = signal(false);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('Notification' in window)) return;
    try { if (localStorage.getItem(DISMISSED_KEY)) return; } catch { return; }
    if (Notification.permission !== 'default') return;
    if (!this.push.isSupported) return;

    // Show after a delay so it doesn't appear immediately on every page load
    setTimeout(() => {
      if (this.auth.isLoggedIn() && Notification.permission === 'default') {
        this.show.set(true);
      }
    }, 5000);
  }

  async activate() {
    this.loading.set(true);
    this.error.set(false);
    const userId = this.auth.user()?.id;
    if (!userId) { this.loading.set(false); return; }

    const result = await this.push.requestAndSubscribe(userId);
    this.loading.set(false);

    if (result === 'error') {
      // Permission may be granted but saving the subscription failed — keep the
      // banner so the user can retry (app.component also retries on next login).
      this.error.set(true);
      return;
    }
    this.show.set(false);
    if (result === 'denied') {
      // Permission denied — don't ask again
      try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage unavailable */ }
    }
  }

  dismiss() {
    this.show.set(false);
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch { /* storage unavailable */ }
  }
}
