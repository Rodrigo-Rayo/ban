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
      <div class="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 md:bottom-4 animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-dark-800 border border-primary-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-2xl shadow-black/40 max-w-sm md:ml-auto md:mr-4">
          <div class="w-10 h-10 rounded-xl bg-primary-900 border border-primary-500/30 flex items-center justify-center flex-shrink-0 text-lg">
            🔔
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-ink leading-tight">Activa las notificaciones</p>
            <p class="text-xs text-ink-muted mt-0.5 leading-snug">Recibe tus mensajes aunque tengas la app cerrada</p>
          </div>
          <div class="flex flex-col gap-1.5 flex-shrink-0">
            <button (click)="activate()"
              [disabled]="loading()"
              class="px-3 py-1.5 bg-primary-500 hover:bg-primary-400 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap min-h-[32px]">
              {{ loading() ? 'Activando…' : 'Activar' }}
            </button>
            <button (click)="dismiss()"
              class="px-3 py-1.5 text-ink-muted hover:text-ink text-xs rounded-xl transition-colors whitespace-nowrap">
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

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('Notification' in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
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
    const userId = this.auth.user()?.id;
    if (!userId) { this.loading.set(false); return; }

    const granted = await this.push.requestAndSubscribe(userId);
    this.loading.set(false);
    this.show.set(false);

    if (!granted) {
      // Permission denied — don't ask again
      localStorage.setItem(DISMISSED_KEY, '1');
    }
  }

  dismiss() {
    this.show.set(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  }
}
