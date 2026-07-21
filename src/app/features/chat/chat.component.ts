import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagesService } from '../../core/services/messages.service';
import { Message } from '../../core/models';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './chat.component.html',
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesList') private messagesList!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);

  private readonly MESSAGES_LIMIT = 50;
  private messageOffset = 0;

  messages = signal<Message[]>([]);
  otherName = signal('');
  newMessage = '';
  currentUserId = '';
  loading = signal(true);
  sending = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  sendError = signal('');
  private subscription: RealtimeChannel | undefined;
  private conversationId = '';

  async ngOnInit() {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (!routeId) { this.router.navigate(['/inbox']); return; }
    this.conversationId = routeId;
    this.messagesService.setActiveChat(this.conversationId);

    const navName = history.state?.name;
    if (navName && typeof navName === 'string') this.otherName.set(navName);

    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUserId = user?.id || '';

    try {
      const [{ messages: msgs, hasMore }, conv] = await Promise.all([
        this.messagesService.getMessages(this.conversationId, this.MESSAGES_LIMIT, 0),
        this.messagesService.getConversationById(this.conversationId),
      ]);
      this.messages.set(msgs);
      this.hasMore.set(hasMore);
      this.messageOffset = msgs.length;
      setTimeout(() => this.scrollToBottom(), 0);

      this.messagesService.markAsRead(this.conversationId);
      if (conv) {
        this.messagesService.getOtherUserProfile(conv).then(resolved => {
          if (resolved && resolved !== 'Usuario') this.otherName.set(resolved);
        });
      }
    } catch {
      this.sendError.set('No se pudieron cargar los mensajes. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }

    this.subscription = this.messagesService.subscribeToMessages(
      this.conversationId,
      (msg) => {
        this.messages.update(list =>
          list.some(m => m.id === msg.id) ? list : [...list, msg]
        );
        setTimeout(() => this.scrollToBottom(), 0);
        // Mark new message as read and refresh the navbar badge
        this.messagesService.markAsRead(this.conversationId);
      }
    );
  }

  ngOnDestroy() {
    this.messagesService.setActiveChat(null);
    if (this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
  }

  async send() {
    const content = this.newMessage.trim();
    if (!content || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    try {
      const msg = await this.messagesService.sendMessage(this.conversationId, content);
      this.sending.set(false);
      if (msg) {
        this.newMessage = '';
        this.messages.update(list =>
          list.some(m => m.id === msg.id) ? list : [...list, msg]
        );
        setTimeout(() => this.scrollToBottom(), 0);
      } else {
        this.sendError.set('Error desconocido al enviar.');
      }
    } catch {
      this.sending.set(false);
      this.sendError.set('No se pudo enviar. Inténtalo de nuevo.');
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  async deleteConversation() {
    if (!confirm('¿Borrar esta conversación? Se eliminarán todos los mensajes.')) return;
    const err = await this.messagesService.deleteConversation(this.conversationId);
    if (err) {
      this.sendError.set(err);
      return;
    }
    this.router.navigate(['/inbox']);
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      const { messages: older, hasMore } = await this.messagesService.getMessages(
        this.conversationId,
        this.MESSAGES_LIMIT,
        this.messageOffset,
      );
      this.messages.update(list => [...older, ...list]);
      this.hasMore.set(hasMore);
      this.messageOffset += older.length;
    } catch {
      // non-critical — user can retry
    } finally {
      this.loadingMore.set(false);
    }
  }

  formatMessageTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffH = Math.floor(diffMs / 3_600_000);
    const hhmm = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffH < 24) return `hace ${diffH} h`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `ayer ${hhmm}`;

    const dd = date.getDate().toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mm} ${hhmm}`;
  }

  private scrollToBottom() {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
