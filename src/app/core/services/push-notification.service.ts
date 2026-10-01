import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private swPush = inject(SwPush);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  private currentEndpoint: string | null = null;

  constructor() {
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification as any).data?.url;
      // Only allow relative paths to prevent open redirect via crafted push payloads
      if (url && typeof url === 'string' && /^\/[^/]/.test(url)) {
        this.router.navigateByUrl(url);
      }
    });
  }

  get isSupported(): boolean {
    return this.swPush.isEnabled;
  }

  get permission(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  /** Auto-subscribe silently — only if the user already granted permission (no dialog). */
  async subscribe(userId: string): Promise<void> {
    if (!this.swPush.isEnabled) return;
    if (this.permission !== 'granted') return;
    try {
      await this.doSubscribe(userId);
    } catch (err) {
      // FCM / push service / DB can reject the registration (network, quota, etc.) — not fatal
      if (!environment.production) console.error('[push] subscribe failed:', err);
    }
  }

  /**
   * Request permission via a user gesture, then subscribe.
   * 'denied' = the user refused; 'error' = permission granted (or undecided) but the
   * browser push service or the DB rejected the subscription — safe to retry later.
   */
  async requestAndSubscribe(userId: string): Promise<'granted' | 'denied' | 'error'> {
    if (!this.swPush.isEnabled) return 'error';
    try {
      await this.doSubscribe(userId);
      return this.permission === 'granted' ? 'granted' : 'denied';
    } catch (err) {
      if (!environment.production) console.error('[push] subscribe failed:', err);
      return this.permission === 'denied' ? 'denied' : 'error';
    }
  }

  private async doSubscribe(userId: string): Promise<void> {
    const sub = await this.swPush.requestSubscription({
      serverPublicKey: environment.vapidPublicKey,
    });
    const subJson = sub.toJSON();
    const keys = subJson.keys as { p256dh: string; auth: string } | undefined;
    if (!subJson.endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Push subscription is missing endpoint or keys');
    }
    const { error } = await this.supabase.client.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' });
    if (error) throw new Error(error.message);
    this.currentEndpoint = subJson.endpoint;
  }

  /** Unsubscribes only this device. Other devices keep their push subscriptions. */
  async unsubscribeDevice(userId: string): Promise<void> {
    if (!this.swPush.isEnabled) return;
    try {
      // After a reload currentEndpoint is unset — fall back to the live SW subscription
      // so logout still removes this device's row (otherwise pushes keep arriving).
      const endpoint = this.currentEndpoint
        // swPush.subscription never emits until the service worker is ready: cap the wait.
        ?? (await firstValueFrom(this.swPush.subscription.pipe(timeout(1500))).catch(() => null))?.endpoint
        ?? null;
      if (endpoint) {
        const { error } = await this.supabase.client
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        if (error && !environment.production) console.error('[push] delete subscription failed:', error.message);
        this.currentEndpoint = null;
      }
      await this.swPush.unsubscribe();
    } catch (err) {
      if (!environment.production) console.error('[push] unsubscribe failed:', err);
    }
  }
}
