import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private supabase = inject(SupabaseService);
  unreadCount = signal(0);
  private channel: any = null;

  async loadUnread(userId: string) {
    const { count } = await this.supabase.client
      .from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('read', false);
    this.unreadCount.set(count || 0);
  }

  async getAll(userId: string): Promise<any[]> {
    const { data } = await this.supabase.client
      .from('notifications').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50);
    return data || [];
  }

  async markAllRead(userId: string) {
    await this.supabase.client.from('notifications')
      .update({ read: true }).eq('user_id', userId).eq('read', false);
    this.unreadCount.set(0);
  }

  async create(userId: string, type: string, title: string, body?: string, entityType?: string, entityId?: string) {
    await this.supabase.client.from('notifications').insert({
      user_id: userId, type, title, body, entity_type: entityType, entity_id: entityId,
    });
  }

  subscribe(userId: string, onNew: () => void) {
    this.channel = this.supabase.client
      .channel(`notifications_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
      }, () => { this.unreadCount.update(n => n + 1); onNew(); })
      .subscribe();
    return this.channel;
  }

  unsubscribe() {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
