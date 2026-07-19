import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Router } from '@angular/router';
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
      if (url) this.router.navigateByUrl(url);
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
    await this.doSubscribe(userId);
  }

  /** Request permission via a user gesture, then subscribe. Returns true if granted. */
  async requestAndSubscribe(userId: string): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;
    try {
      await this.doSubscribe(userId);
      return this.permission === 'granted';
    } catch {
      return false;
    }
  }

  private async doSubscribe(userId: string): Promise<void> {
    const sub = await this.swPush.requestSubscription({
      serverPublicKey: environment.vapidPublicKey,
    });
    const subJson = sub.toJSON();
    const keys = subJson.keys as { p256dh: string; auth: string } | undefined;
    if (!keys?.p256dh || !keys?.auth) return;
    this.currentEndpoint = subJson.endpoint ?? null;
    await this.supabase.client.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' });
  }

  /** Unsubscribes only this device. Other devices keep their push subscriptions. */
  async unsubscribeDevice(userId: string): Promise<void> {
    if (!this.swPush.isEnabled) return;
    try {
      if (this.currentEndpoint) {
        await this.supabase.client
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', this.currentEndpoint);
        this.currentEndpoint = null;
      }
      await this.swPush.unsubscribe();
    } catch { /* ignore */ }
  }
}
