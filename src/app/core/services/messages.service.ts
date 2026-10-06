import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Conversation, Message } from '../models';
import { environment } from '../../../environments/environment';
import { ProfileGateService } from './profile-gate.service';

export interface InboxUpdate { senderName: string; preview: string; conversationId: string; }

/** Callbacks for the chat's live signals (typing indicator, online presence). */
export interface ChatLiveHandlers {
  userId: string;
  onTyping: (userId: string) => void;
  onPresence: (onlineUserIds: string[]) => void;
}

const TYPING_EVENT = 'typing';

/** Hard cap on message length — mirrored by the chat textarea's maxlength. */
export const MAX_MESSAGE_LENGTH = 2000;
/** Max characters kept for conversation previews / toasts. */
const PREVIEW_LENGTH = 140;
/** Debounce for unread-count refreshes triggered by bursts of realtime events. */
const UNREAD_REFRESH_DEBOUNCE_MS = 400;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private supabase = inject(SupabaseService);
  private gate = inject(ProfileGateService);

  /** Tracks which conversation the user is currently viewing. */
  activeChatConversationId = signal<string | null>(null);

  /** Shared unread message count — updated by markAsRead and real-time events. */
  unreadCount = signal(0);

  /** Shared stream of new incoming messages — fed by the navbar's single subscription. */
  readonly inboxUpdate$ = new Subject<InboxUpdate>();

  private readonly _nameCache = new Map<string, string>();
  /** Conversation ids verified (via RLS-scoped select) to belong to the current user. */
  private readonly _myConvIds = new Set<string>();
  /** Ids a realtime event referenced that are NOT the current user's — never re-queried. */
  private readonly _foreignConvIds = new Set<string>();
  private _myConvIdsOwner: string | null = null;
  private _unreadRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  setActiveChat(id: string | null) {
    this.activeChatConversationId.set(id);
  }

  /** Re-reads the unread count from the DB. On error the previous value is kept. */
  async refreshUnreadCount() {
    try {
      this.unreadCount.set(await this.getUnreadCount());
    } catch (err) {
      if (!environment.production) console.error('[messages] unread count error:', err);
    }
  }

  private scheduleUnreadRefresh() {
    if (this._unreadRefreshTimer) clearTimeout(this._unreadRefreshTimer);
    this._unreadRefreshTimer = setTimeout(() => {
      this._unreadRefreshTimer = null;
      this.refreshUnreadCount();
    }, UNREAD_REFRESH_DEBOUNCE_MS);
  }

  private rememberConversations(userId: string, ids: string[]) {
    if (this._myConvIdsOwner !== userId) {
      this._myConvIds.clear();
      this._foreignConvIds.clear();
      this._myConvIdsOwner = userId;
    }
    ids.forEach(id => this._myConvIds.add(id));
  }

  /**
   * Defense in depth for the inbox Realtime channel: Realtime already applies the
   * messages SELECT RLS policy, but we additionally confirm the conversation is one
   * the user participates in before surfacing it (badge / toast / inbox list).
   */
  private async isMyConversation(userId: string, conversationId: string): Promise<boolean> {
    if (!conversationId) return false;
    if (this._myConvIdsOwner === userId && this._myConvIds.has(conversationId)) return true;
    if (this._myConvIdsOwner === userId && this._foreignConvIds.has(conversationId)) return false;
    const conv = await this.getConversationById(conversationId);
    const mine = !!conv && (conv.user1_id === userId || conv.user2_id === userId);
    if (mine) {
      this.rememberConversations(userId, [conversationId]);
    } else if (this._myConvIdsOwner === userId) {
      this._foreignConvIds.add(conversationId);
    }
    return mine;
  }

  private async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user ?? null;
  }

  async getOrCreateConversation(otherUserId: string, otherName?: string): Promise<{ id: string } | { error: string } | null> {
    const user = await this.getCurrentUser();
    if (!user) return { error: 'Debes iniciar sesión para enviar mensajes.' };
    if (!otherUserId) return { error: 'Este perfil aún no tiene cuenta activa.' };
    if (user.id === otherUserId) return { error: 'No puedes enviarte mensajes a ti mismo.' };
    if (!(await this.gate.ensure({ toast: false }))) return { error: 'Crea tu perfil para escribir mensajes. Sin perfil solo puedes mirar.' };

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
    if (existing) {
      this.rememberConversations(myId, [existing.id]);
      return { id: existing.id };
    }

    const myName = await this.getUserName(myId);
    const u1_name = u1 === myId ? (myName !== 'Usuario' ? myName : null) : (otherName ?? null);
    const u2_name = u2 === myId ? (myName !== 'Usuario' ? myName : null) : (otherName ?? null);

    const { data: created, error } = await this.supabase.client
      .from('conversations')
      .insert({ user1_id: u1, user2_id: u2, user1_name: u1_name, user2_name: u2_name })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 = unique violation: the other user (or a double click) created it first.
      if (error.code === '23505') {
        const { data: raced } = await this.supabase.client
          .from('conversations').select('id')
          .eq('user1_id', u1).eq('user2_id', u2).maybeSingle();
        if (raced) {
          this.rememberConversations(myId, [raced.id]);
          return { id: raced.id };
        }
      }
      return { error: 'No se pudo crear la conversación. Inténtalo de nuevo.' };
    }
    if (!created) return { error: 'No se pudo crear la conversación. Inténtalo de nuevo.' };
    this.rememberConversations(myId, [created.id]);
    return { id: created.id };
  }

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase.client
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();
    if (error && !environment.production) console.error('[conversations] get error:', error.message);
    return (data as Conversation) ?? null;
  }

  async deleteConversation(conversationId: string): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (!user) return 'No autenticado';

    // Deleting the conversation cascades to delete all messages via ON DELETE CASCADE
    const { error: convErr, count: convCount } = await this.supabase.client
      .from('conversations').delete({ count: 'exact' }).eq('id', conversationId);
    if (convErr) return 'No se pudo eliminar la conversación. Inténtalo de nuevo.';

    if (convCount === 0) return 'No tienes permisos para borrar esta conversación.';

    this._myConvIds.delete(conversationId);
    // The deleted thread may have had unread messages.
    this.scheduleUnreadRefresh();
    return null;
  }

  async getConversations(): Promise<Conversation[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await this.supabase.client
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      // Postgres sorts NULLs first on DESC — keep never-messaged threads at the bottom.
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    const convs = (data || []) as Conversation[];
    this.rememberConversations(user.id, convs.map(c => c.id));
    return convs;
  }

  /**
   * Fetches the newest `limit` messages, or — when `before` (an ISO created_at) is
   * given — the `limit` messages immediately older than it. Cursor-based so that
   * messages arriving via Realtime/optimistic sends never shift the page window.
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    let query = this.supabase.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    // Reverse so oldest-first in UI while fetching newest-first from DB
    const messages = ((data || []) as Message[]).reverse();
    return { messages, hasMore: (data?.length ?? 0) === limit };
  }

  async sendMessage(conversationId: string, content: string): Promise<Message | null> {
    const text = content.trim();
    if (!text) throw new Error('El mensaje está vacío.');
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.`);
    }

    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase.client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, text })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    let message = data as Message | null;
    if (!message) {
      const { data: fallback } = await this.supabase.client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      message = (fallback as Message | null) ?? null;
      if (!message) return null;
    }

    // conversations.last_message / last_message_at are maintained by the
    // trg_bump_conversation trigger (supabase/audit_2026_10_messaging.sql).
    this.triggerPushNotification(conversationId, message.id, text);

    return message;
  }

  async markAsRead(conversationId: string, skipCountRefresh = false) {
    const user = await this.getCurrentUser();
    if (!user) return;

    // Only the `read` column is ever written (the DB restricts UPDATE to it).
    const { error } = await this.supabase.client
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('read', false);
    if (error) throw new Error(error.message);
    if (!skipCountRefresh) await this.refreshUnreadCount();
  }

  async getUnreadCount(): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user) return 0;

    // RLS ensures we only see messages from conversations we participate in.
    const { count, error } = await this.supabase.client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', user.id);

    if (error) throw new Error(error.message);
    return count || 0;
  }

  async getUserName(userId: string): Promise<string> {
    if (!userId) return 'Usuario';
    const cached = this._nameCache.get(userId);
    if (cached) return cached;

    // Single RPC call instead of 5 parallel queries
    const { data, error } = await this.supabase.client.rpc('get_profile_name', { p_user_id: userId });
    if (error && !environment.production) console.error('[messages] get_profile_name error:', error.message);
    const name = typeof data === 'string' && data.trim() ? data : null;
    // Only cache real names: a transient error or a not-yet-created profile must
    // not pin the 'Usuario' placeholder for the rest of the session.
    if (!name) return 'Usuario';
    this._nameCache.set(userId, name);
    return name;
  }

  async getUnreadConversationIds(): Promise<Set<string>> {
    const user = await this.getCurrentUser();
    if (!user) return new Set();
    const { data, error } = await this.supabase.client
      .from('messages')
      .select('conversation_id')
      .eq('read', false)
      .neq('sender_id', user.id)
      .limit(500);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((m: { conversation_id: string }) => m.conversation_id));
  }

  /**
   * Fire-and-forget Web Push. Only ids are sent: the edge function derives the
   * sender name and message text from the stored row instead of trusting the client.
   */
  private triggerPushNotification(conversationId: string, messageId: string, text: string): void {
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      return fetch(`${environment.supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        // senderId/messageText keep the previously deployed function working until
        // send-push is redeployed; the new function ignores the text and validates senderId.
        body: JSON.stringify({ conversationId, messageId, senderId: session.user?.id, messageText: truncate(text, PREVIEW_LENGTH) }),
      });
    }).catch(err => {
      if (!environment.production) console.error('[messages] push trigger failed:', err);
    });
  }

  /**
   * Single inbox channel (owned by the navbar). Realtime enforces the messages
   * SELECT RLS policy, and every event is re-checked client-side: own messages and
   * conversations the user is not part of are ignored. UPDATE events (read flag
   * flipped in another tab/device) refresh the unread badge.
   */
  subscribeToInboxUpdates(currentUserId: string, onNewMessage: (senderName: string, preview: string, conversationId: string) => void, channelSuffix = '') {
    const name = channelSuffix
      ? `inbox-updates-${currentUserId}-${channelSuffix}`
      : `inbox-updates-${currentUserId}`;
    if (this._myConvIdsOwner !== currentUserId) this.rememberConversations(currentUserId, []);
    return this.supabase.client
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as Message;
        if (!msg?.conversation_id || !msg.sender_id || msg.sender_id === currentUserId) return;
        try {
          if (!(await this.isMyConversation(currentUserId, msg.conversation_id))) return;
          const resolvedName = await this.getUserName(msg.sender_id);
          onNewMessage(resolvedName, truncate(msg.text ?? '', PREVIEW_LENGTH), msg.conversation_id);
        } catch (err) {
          if (!environment.production) console.error('[messages] inbox event error:', err);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Partial<Message>;
        if (msg?.read === true && msg.sender_id !== currentUserId) this.scheduleUnreadRefresh();
      })
      .subscribe();
  }

  /**
   * Thread channel: INSERTs deliver new messages; UPDATEs (the other side flipping
   * `read`) drive the sent/read ticks.
   */
  subscribeToMessages(
    conversationId: string,
    callback: (msg: Message) => void,
    onUpdate?: (msg: Message) => void,
    live?: ChatLiveHandlers,
    /** The conversation row was deleted (by either participant). */
    onGone?: () => void,
  ) {
    const filter = `conversation_id=eq.${conversationId}`;
    const channel = this.supabase.client
      .channel(`messages:${conversationId}`, live ? { config: { presence: { key: live.userId } } } : undefined)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter },
        (payload) => callback(payload.new as unknown as Message))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter },
        (payload) => onUpdate?.(payload.new as unknown as Message))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        () => onGone?.());
    if (!live) return channel.subscribe();

    // Ephemeral "typing…" / "online" signals: Realtime broadcast + presence, nothing stored.
    return channel
      .on('broadcast', { event: TYPING_EVENT }, ({ payload }) => {
        const from = (payload as { userId?: unknown })?.userId;
        if (typeof from === 'string' && from !== live.userId) live.onTyping(from);
      })
      .on('presence', { event: 'sync' }, () => live.onPresence(Object.keys(channel.presenceState())))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') channel.track({ online_at: new Date().toISOString() }).catch(() => {});
      });
  }

  /** Tells the other participant we are typing (callers throttle). */
  sendTyping(channel: RealtimeChannel, userId: string): void {
    channel.send({ type: 'broadcast', event: TYPING_EVENT, payload: { userId } }).catch(() => {});
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
