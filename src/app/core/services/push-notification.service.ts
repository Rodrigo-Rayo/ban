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

  constructor() {
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification as any).data?.url;
      if (url) this.router.navigateByUrl(url);
    });
  }

  async subscribe(userId: string): Promise<void> {
    if (!this.swPush.isEnabled) return;

    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey,
      });

      const subJson = sub.toJSON();
      const keys = subJson.keys as { p256dh: string; auth: string } | undefined;
      if (!keys?.p256dh || !keys?.auth) return;

      await this.supabase.client.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }, { onConflict: 'user_id,endpoint' });
    } catch {
      // User denied permission or SW not available — fail silently
    }
  }

  async unsubscribeAll(userId: string): Promise<void> {
    if (!this.swPush.isEnabled) return;
    try {
      await this.supabase.client.from('push_subscriptions').delete().eq('user_id', userId);
      await this.swPush.unsubscribe();
    } catch { /* ignore */ }
  }
}
