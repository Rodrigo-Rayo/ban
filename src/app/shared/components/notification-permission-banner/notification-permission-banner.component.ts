import { Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { IconComponent } from '../icon/icon.component';
import { bannerWants, showNotifBanner } from '../cookie-banner/banner-queue';

const DISMISSED_KEY = 'notif-permission-dismissed';

@Component({
  selector: 'app-notification-permission-banner',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (show()) {
      <div class="fixed bottom-above-nav left-0 right-0 z-40 px-4 pb-2 lg:pb-4 animate-slide-in">
        <div class="bg-dark-800 border-2 border-ink p-4 flex items-center gap-3 shadow-[4px_4px_0_0_#141210] max-w-sm md:ml-auto md:mr-4">
          <div class="w-10 h-10 bg-poster-yellow border-2 border-ink flex items-center justify-center flex-shrink-0">
            <app-icon name="bell" [size]="20"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-display text-xl uppercase text-ink leading-tight">Activa las notificaciones</p>
            @if (error()) {
              <p class="text-xs font-bold text-signal-red mt-0.5 leading-snug" role="alert">No se pudieron activar. Inténtalo de nuevo.</p>
            } @else {
              <p class="text-xs text-ink-2 mt-0.5 leading-snug">Recibe tus mensajes aunque tengas la app cerrada</p>
            }
          </div>
          <div class="flex flex-col gap-1.5 flex-shrink-0">
            <button type="button" (click)="activate()"
              [disabled]="loading()"
              class="btn-primary px-3 py-2 text-xs disabled:opacity-60 whitespace-nowrap min-h-[44px]">
              {{ loading() ? 'Activando…' : 'Activar' }}
            </button>
            <button type="button" (click)="dismiss()"
              class="px-3 py-2 font-mono font-bold uppercase text-ink hover:text-primary-600 text-[11px] transition-colors whitespace-nowrap min-h-[44px]">
              Ahora no
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NotificationPermissionBannerComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private push = inject(PushNotificationService);

  /** Visible only while the cookie notice is not showing. */
  readonly show = showNotifBanner;
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
        bannerWants.notif.set(true);
      }
    }, 5000);
  }

  ngOnDestroy() {
    bannerWants.notif.set(false);
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
    bannerWants.notif.set(false);
    if (result === 'denied') {
      // Permission denied — don't ask again
      try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage unavailable */ }
    }
  }

  dismiss() {
    bannerWants.notif.set(false);
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch { /* storage unavailable */ }
  }
}
