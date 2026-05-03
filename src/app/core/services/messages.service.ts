import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { NotificationsService } from './notifications.service';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private supabase = inject(SupabaseService);
  private notifSvc = inject(NotificationsService);

  private async getCurrentUser() {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.user ?? null;
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
    if (!user) return null;

    const { data, error } = await this.supabase.client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, text: content })
      .select()
      .single();

    if (error) { console.error('Error enviando mensaje:', error.message); return null; }

    await this.supabase.client
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
    // fire-and-forget update — non-critical if it fails

    this.createMessageNotification(conversationId, user.id, content);

    return data;
  }

  private async createMessageNotification(conversationId: string, senderId: string, content: string) {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return;
    const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
    if (!recipientId) return;
    const senderName = await this.getUserName(senderId);
    const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
    await this.notifSvc.create(recipientId, 'message', `Nuevo mensaje de ${senderName}`, preview, 'conversation', conversationId);
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
    const { data } = await this.supabase.client
      .from('messages')
      .select('conversation_id')
      .eq('read', false)
      .neq('sender_id', user.id);
    return new Set((data || []).map((m: any) => m.conversation_id));
  }

  subscribeToInboxUpdates(currentUserId: string, onNewMessage: (senderName: string, preview: string, conversationId: string) => void) {
    return this.supabase.client
      .channel(`inbox-updates-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== currentUserId) {
          const name = await this.getUserName(msg.sender_id);
          onNewMessage(name, msg.text, msg.conversation_id);
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
