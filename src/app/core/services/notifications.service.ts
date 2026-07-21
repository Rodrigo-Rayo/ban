import { Injectable, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Notification as AppNotification } from '../models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private supabase = inject(SupabaseService);
  unreadCount = signal(0);
  /** Emits the most-recently received notification via Realtime (null on init / after reset). */
  latestNotification = signal<AppNotification | null>(null);
  private channel: RealtimeChannel | null = null;

  async loadUnread(userId: string) {
    const { count, error } = await this.supabase.client
      .from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('read', false);
    if (!error) this.unreadCount.set(count || 0);
  }

  async getAll(userId: string): Promise<AppNotification[]> {
    const { data, error } = await this.supabase.client
      .from('notifications').select('id, user_id, type, title, body, entity_type, entity_id, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return data || [];
  }

  async markAllRead(userId: string) {
    const { error } = await this.supabase.client.from('notifications')
      .update({ read: true }).eq('user_id', userId).eq('read', false);
    if (!error) this.unreadCount.set(0);
  }

  /**
   * Creates a notification for any user.
   * Routes through the `create_notification` SECURITY DEFINER RPC so that
   * direct cross-user INSERTs are not needed (and are blocked by RLS).
   */
  async create(userId: string, type: string, title: string, body?: string, entityType?: string, entityId?: string) {
    await this.supabase.client.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body ?? null,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
    });
  }

  subscribe(userId: string, onNew: () => void) {
    // Guard against duplicate channels if subscribe() is called more than once
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
    this.channel = this.supabase.client
      .channel(`notifications_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as AppNotification;
        this.latestNotification.set(n);
        this.unreadCount.update(c => c + 1);
        onNew();
      })
      .subscribe();
    return this.channel;
  }

  /** Hard-delete all notifications for the user and reset the unread counter. */
  async deleteAll(userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('notifications').delete().eq('user_id', userId);
    if (!error) this.unreadCount.set(0);
  }

  unsubscribe() {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
