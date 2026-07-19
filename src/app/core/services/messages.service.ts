import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { Conversation, Message } from '../models';
import { environment } from '../../../environments/environment';

export interface InboxUpdate { senderName: string; preview: string; conversationId: string; }

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private supabase = inject(SupabaseService);

  /** Tracks which conversation the user is currently viewing. */
  activeChatConversationId = signal<string | null>(null);

  /** Shared unread message count — updated by markAsRead and real-time events. */
  unreadCount = signal(0);

  /** Shared stream of new incoming messages — fed by the navbar's single subscription. */
  readonly inboxUpdate$ = new Subject<InboxUpdate>();

  private readonly _nameCache = new Map<string, string>();
  private _cachedConvIds: string[] | null = null;

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

    if (selectErr && !environment.production) console.error('[conversations] select error:', selectErr.message);
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

    // Deleting the conversation cascades to delete all messages via ON DELETE CASCADE
    const { error: convErr, count: convCount } = await this.supabase.client
      .from('conversations').delete({ count: 'exact' }).eq('id', conversationId);
    if (convErr) return convErr.message;

    if (convCount === 0) return 'No tienes permisos para borrar esta conversación.';

    this._cachedConvIds = this._cachedConvIds?.filter(id => id !== conversationId) ?? null;
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

    const convs = (data || []) as Conversation[];
    this._cachedConvIds = convs.map(c => c.id);
    return convs;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await this.supabase.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Reverse so oldest-first in UI while fetching newest-first from DB
    return ((data || []) as Message[]).reverse();
  }

  async sendMessage(conversationId: string, content: string): Promise<Message | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase.client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, text: content })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      const { data: fallback } = await this.supabase.client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!fallback) return null;
      return fallback as Message;
    }

    this.supabase.client
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
      .then(() => {});

    this.triggerPushNotification(conversationId, user.id, content);

    return data as Message;
  }

  async markAsRead(conversationId: string, skipCountRefresh = false) {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.supabase.client
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id);
    if (!skipCountRefresh) await this.refreshUnreadCount();
  }

  async getUnreadCount(): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user) return 0;

    // Query directly without relying on stale _cachedConvIds — RLS ensures
    // we only see messages from conversations we participate in.
    const { count } = await this.supabase.client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', user.id);

    return count || 0;
  }

  async getUserName(userId: string): Promise<string> {
    if (!userId) return 'Usuario';
    const cached = this._nameCache.get(userId);
    if (cached) return cached;

    // Single RPC call instead of 5 parallel queries
    const { data } = await this.supabase.client.rpc('get_profile_name', { p_user_id: userId });
    const name = (data as string | null) ?? 'Usuario';
    this._nameCache.set(userId, name);
    return name;
  }

  async getUnreadConversationIds(): Promise<Set<string>> {
    const user = await this.getCurrentUser();
    if (!user) return new Set();
    const { data } = await this.supabase.client
      .from('messages')
      .select('conversation_id')
      .eq('read', false)
      .neq('sender_id', user.id)
      .limit(500);
    return new Set((data || []).map((m: { conversation_id: string }) => m.conversation_id));
  }

  private triggerPushNotification(conversationId: string, senderId: string, messageText: string): void {
    Promise.all([
      this.getUserName(senderId),
      this.supabase.auth.getSession(),
    ]).then(([senderName, { data: { session } }]) => {
      if (!session?.access_token) return;
      fetch(`${environment.supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversationId, senderId, senderName, messageText }),
      }).catch(() => {});
    }).catch(() => {});
  }

  subscribeToInboxUpdates(currentUserId: string, onNewMessage: (senderName: string, preview: string, conversationId: string) => void, channelSuffix = '') {
    const name = channelSuffix
      ? `inbox-updates-${currentUserId}-${channelSuffix}`
      : `inbox-updates-${currentUserId}`;
    return this.supabase.client
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== currentUserId) {
          const resolvedName = await this.getUserName(msg.sender_id);
          onNewMessage(resolvedName, msg.text, msg.conversation_id);
        }
      })
      .subscribe();
  }

  subscribeToMessages(conversationId: string, callback: (msg: Message) => void) {
    return this.supabase.client
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => callback(payload.new as unknown as Message))
      .subscribe();
  }

  async getOtherUserProfile(conversation: Conversation): Promise<string> {
    const user = await this.getCurrentUser();
    if (!user) return 'Usuario';

    const isUser1 = conversation.user1_id === user.id;

    const cached = isUser1 ? conversation.user2_name : conversation.user1_name;
    if (cached) return cached;

    const otherId = isUser1 ? conversation.user2_id : conversation.user1_id;
    if (!otherId) return 'Usuario';
    return this.getUserName(otherId);
  }
}
