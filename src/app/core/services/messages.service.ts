import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private supabase = inject(SupabaseService);

  /** Tracks which conversation the user is currently viewing. */
  activeChatConversationId = signal<string | null>(null);

  /** Shared unread message count — updated by markAsRead and real-time events. */
  unreadCount = signal(0);

  setActiveChat(id: string | null) {
    this.activeChatConversationId.set(id);
  }

  async refreshUnreadCount() {
    const count = await this.getUnreadCount();
    this.unreadCount.set(count);
  }

  private async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user ?? null;
  }

  async getOrCreateConversation(otherUserId: string, otherName?: string): Promise<{ id: string } | { error: string } | null> {
    const user = await this.getCurrentUser();
    if (!user) return { error: 'Debes iniciar sesión para enviar mensajes.' };
    if (!otherUserId) return { error: 'Este perfil aún no tiene cuenta activa.' };

    const myId = user.id;
    const u1 = myId < otherUserId ? myId : otherUserId;
    const u2 = myId < otherUserId ? otherUserId : myId;

    const { data: existing, error: selectErr } = await this.supabase.client
      .from('conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (selectErr) console.error('[conversations] select error:', selectErr.message);
    if (existing) return { id: existing.id };

    const myName = await this.getUserName(myId);
    const u1_name = u1 === myId ? (myName !== 'Usuario' ? myName : null) : (otherName ?? null);
    const u2_name = u2 === myId ? (myName !== 'Usuario' ? myName : null) : (otherName ?? null);

    const { data: created, error } = await this.supabase.client
      .from('conversations')
      .insert({ user1_id: u1, user2_id: u2, user1_name: u1_name, user2_name: u2_name })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[conversations] insert error:', error.message, error.code);
      return { error: 'No se pudo crear la conversación. Inténtalo de nuevo.' };
    }
    return created ? { id: created.id } : null;
  }

  async getConversationById(conversationId: string) {
    const { data } = await this.supabase.client
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();
    return data;
  }

  async deleteConversation(conversationId: string): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (!user) return 'No autenticado';

    const { error: msgErr } = await this.supabase.client
      .from('messages').delete({ count: 'exact' }).eq('conversation_id', conversationId);
    if (msgErr) { console.error('Error borrando mensajes:', msgErr.message); return msgErr.message; }

    const { error: convErr, count: convCount } = await this.supabase.client
      .from('conversations').delete({ count: 'exact' }).eq('id', conversationId);
    if (convErr) { console.error('Error borrando conversación:', convErr.message); return convErr.message; }

    if (convCount === 0) {
      console.warn('deleteConversation: 0 rows deleted — check RLS policies on conversations table');
      return 'No tienes permisos para borrar esta conversación.';
    }

    return null;
  }

  async getConversations(): Promise<Conversation[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await this.supabase.client
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    return (data || []) as Conversation[];
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await this.supabase.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return (data || []) as Message[];
  }

  async sendMessage(conversationId: string, content: string): Promise<Message | null> {
    const user = await this.getCurrentUser();
    if (!user) { console.error('[sendMessage] no authenticated user'); return null; }

    const { data, error } = await this.supabase.client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, text: content })
      .select()
      .single();

    if (error) {
      console.error('[sendMessage] insert error:', error.message, error.code, error.details);
      throw new Error(`${error.code}: ${error.message}`);
    }

    if (!data) {
      // insert succeeded but select returned nothing — fetch last inserted message as fallback
      const { data: fallback } = await this.supabase.client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!fallback) { console.error('[sendMessage] insert ok but could not fetch message'); return null; }
      return fallback as Message;
    }

    this.supabase.client
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
      .then(({ error: e }) => { if (e) console.error('[sendMessage] conversation update error:', e.message); });

    this.triggerPushNotification(conversationId, user.id, content);

    return data as Message;
  }

  async markAsRead(conversationId: string) {
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await this.supabase.client
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id);
    if (error) console.error('[messages] markAsRead error:', error.message);
    await this.refreshUnreadCount();
  }

  async getUnreadCount(): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user) return 0;

    const convs = await this.getConversations();
    if (!convs.length) return 0;

    const ids = convs.map((c: any) => c.id);
    const { count } = await this.supabase.client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', ids)
      .eq('read', false)
      .neq('sender_id', user.id);

    return count || 0;
  }

  async getUserName(userId: string): Promise<string> {
    if (!userId) return 'Usuario';
    const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
    const results = await Promise.all(
      tables.map(t => this.supabase.client.from(t).select('name').eq('user_id', userId).maybeSingle())
    );
    for (const { data, error } of results) {
      if (error) console.warn('[getUserName] query error:', error.message);
      if (data?.name) return data.name;
    }
    return 'Usuario';
  }

  async getUnreadConversationIds(): Promise<Set<string>> {
    const user = await this.getCurrentUser();
    if (!user) return new Set();
    const convs = await this.getConversations();
    if (!convs.length) return new Set();
    const ids = convs.map((c: any) => c.id);
    const { data } = await this.supabase.client
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', ids)
      .eq('read', false)
      .neq('sender_id', user.id)
      .limit(500);
    return new Set((data || []).map((m: any) => m.conversation_id));
  }

  private triggerPushNotification(conversationId: string, senderId: string, messageText: string): void {
    this.getUserName(senderId).then(senderName => {
      fetch('https://yxaurffzwtqsckfmnzdj.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, senderId, senderName, messageText }),
      }).then(r => console.log('[push] status:', r.status))
        .catch(err => console.error('[push] fetch error:', err));
    });
  }

  subscribeToInboxUpdates(currentUserId: string, onNewMessage: (senderName: string, preview: string, conversationId: string) => void, channelSuffix = '') {
    const name = channelSuffix
      ? `inbox-updates-${currentUserId}-${channelSuffix}`
      : `inbox-updates-${currentUserId}`;
    return this.supabase.client
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== currentUserId) {
          const resolvedName = await this.getUserName(msg.sender_id);
          onNewMessage(resolvedName, msg.text, msg.conversation_id);
        }
      })
      .subscribe();
  }

  subscribeToMessages(conversationId: string, callback: (msg: any) => void) {
    return this.supabase.client
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => callback(payload.new))
      .subscribe();
  }

  async getOtherUserProfile(conversation: any): Promise<string> {
    const user = await this.getCurrentUser();
    if (!user) return 'Usuario';

    const isUser1 = conversation.user1_id === user.id;

    // Use cached name from conversation first (fast, no extra queries)
    const cached = isUser1 ? conversation.user2_name : conversation.user1_name;
    if (cached) return cached;

    // Fallback: query profile tables
    const otherId = isUser1 ? conversation.user2_id : conversation.user1_id;
    if (!otherId) return 'Usuario';
    return this.getUserName(otherId);
  }
}
