import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagesService, MAX_MESSAGE_LENGTH } from '../../core/services/messages.service';
import { Message } from '../../core/models';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';

/** A message as rendered: server rows plus optimistic, not-yet-confirmed sends. */
export type ChatMessage = Message & { status?: 'sending' | 'failed' };

/** Distance (px) from the bottom within which new messages auto-scroll the list. */
const NEAR_BOTTOM_PX = 120;
/** Show the remaining-characters counter once the draft gets this close to the cap. */
const COUNTER_THRESHOLD = 200;

const TEMP_PREFIX = 'tmp-';
/** Shown when the other participant has no profile (deleted or unfinished signup). */
const FALLBACK_NAME = 'Usuario';
/** Min gap between our own "typing" broadcasts. */
const TYPING_SEND_INTERVAL_MS = 2000;
/** The other side's "typing…" label disappears after this long without a new signal. */
const TYPING_DISPLAY_MS = 3500;

function byCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

@Component({
    selector: 'app-chat',
    imports: [RouterLink, CommonModule, FormsModule],
    templateUrl: './chat.component.html'
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesList') private messagesList!: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);

  private readonly MESSAGES_LIMIT = 50;
  readonly maxLength = MAX_MESSAGE_LENGTH;
  readonly counterThreshold = COUNTER_THRESHOLD;

  messages = signal<ChatMessage[]>([]);
  otherName = signal('');
  newMessage = '';
  currentUserId = signal('');
  loading = signal(true);
  sending = signal(false);
  isDeleting = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  sendError = signal('');
  /** True when messages arrived while the user was scrolled up reading history. */
  hasNewBelow = signal(false);
  /** The other participant is typing / has this conversation open right now. */
  otherTyping = signal(false);
  otherOnline = signal(false);
  private otherUserId = '';
  private onlineIds: string[] = [];
  private lastTypingSentAt = 0;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private subscription: RealtimeChannel | undefined;
  private conversationId = '';
  private destroyed = false;
  /** Incoming messages arrived while the tab was hidden — mark read once visible. */
  private pendingRead = false;
  private tempSeq = 0;

  async ngOnInit() {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (!routeId) { this.router.navigate(['/inbox']); return; }
    this.conversationId = routeId;
    this.messagesService.setActiveChat(this.conversationId);

    const navName = history.state?.name;
    if (navName && typeof navName === 'string') this.otherName.set(navName);

    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUserId.set(user?.id ?? '');
    if (this.destroyed) return;

    // Subscribe before the initial fetch so messages sent in between are not lost;
    // the fetch result is merged (deduplicated by id) with anything already received.
    this.subscription = this.messagesService.subscribeToMessages(
      this.conversationId,
      (msg) => this.onIncoming(msg),
      (msg) => this.onUpdated(msg),
      {
        userId: this.currentUserId(),
        onTyping: (from) => this.onOtherTyping(from),
        onPresence: (ids) => { this.onlineIds = ids; this.refreshOnline(); },
      },
    );

    try {
      const [{ messages: msgs, hasMore }, conv] = await Promise.all([
        this.messagesService.getMessages(this.conversationId, this.MESSAGES_LIMIT),
        this.messagesService.getConversationById(this.conversationId),
      ]);
      this.messages.update(current => this.merge(msgs, current));
      this.hasMore.set(hasMore);
      setTimeout(() => this.scrollToBottom(), 0);

      this.markRead();
      if (conv) {
        this.otherUserId = conv.user1_id === this.currentUserId() ? conv.user2_id : conv.user1_id;
        this.refreshOnline();
        this.messagesService.getOtherUserProfile(conv).then(resolved => {
          // Keep a name passed via navigation over the generic placeholder.
          if (resolved && (resolved !== FALLBACK_NAME || !this.otherName())) this.otherName.set(resolved);
        }).catch(() => { if (!this.otherName()) this.otherName.set(FALLBACK_NAME); });
      } else if (!this.otherName()) {
        this.otherName.set(FALLBACK_NAME);
      }
    } catch {
      this.sendError.set('No se pudieron cargar los mensajes. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }

    // Guard against early navigation: ngOnDestroy may already have run while awaiting.
    if (this.destroyed && this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.messagesService.setActiveChat(null);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (this.pendingRead && document.visibilityState === 'visible') this.markRead();
  }

  async send() {
    const content = this.newMessage.trim();
    if (!content || this.sending()) return;
    if (content.length > this.maxLength) {
      this.sendError.set(`El mensaje no puede superar los ${this.maxLength} caracteres.`);
      return;
    }
    this.sendError.set('');
    this.newMessage = '';
    this.lastTypingSentAt = 0;

    const temp: ChatMessage = {
      id: `${TEMP_PREFIX}${Date.now()}-${++this.tempSeq}`,
      conversation_id: this.conversationId,
      sender_id: this.currentUserId(),
      text: content,
      read: false,
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    this.messages.update(list => [...list, temp]);
    setTimeout(() => this.scrollToBottom(), 0);
    await this.deliver(temp);
  }

  /** Re-sends a message whose previous attempt failed. */
  async retry(msg: ChatMessage) {
    if (msg.status !== 'failed' || this.sending()) return;
    this.sendError.set('');
    this.setStatus(msg.id, 'sending');
    await this.deliver(msg);
  }

  /** Drops a failed optimistic message from the thread. */
  discard(msg: ChatMessage) {
    if (msg.status !== 'failed') return;
    this.messages.update(list => list.filter(m => m.id !== msg.id));
    if (!this.messages().some(m => m.status === 'failed')) this.sendError.set('');
  }

  private async deliver(temp: ChatMessage) {
    this.sending.set(true);
    try {
      const msg = await this.messagesService.sendMessage(this.conversationId, temp.text);
      if (msg) {
        this.confirm(temp.id, msg);
      } else {
        this.setStatus(temp.id, 'failed');
        this.sendError.set('Error desconocido al enviar.');
      }
    } catch {
      this.setStatus(temp.id, 'failed');
      this.sendError.set('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  /** Swaps an optimistic message for the stored row (or drops it if Realtime already delivered it). */
  private confirm(tempId: string, msg: Message) {
    this.messages.update(list =>
      list.some(m => m.id === msg.id)
        ? list.filter(m => m.id !== tempId)
        : list.map(m => (m.id === tempId ? msg : m))
    );
  }

  private setStatus(id: string, status: 'sending' | 'failed') {
    this.messages.update(list => list.map(m => (m.id === id ? { ...m, status } : m)));
  }

  private onIncoming(msg: Message) {
    if (!msg?.id || msg.conversation_id !== this.conversationId) return;
    const isMine = msg.sender_id === this.currentUserId();
    const wasNearBottom = this.isNearBottom();

    this.messages.update(list => {
      if (list.some(m => m.id === msg.id)) return list;
      if (isMine) {
        // Realtime echo of our own in-flight send: replace the optimistic bubble.
        const pending = list.find(m => m.status === 'sending' && m.text === msg.text);
        if (pending) return list.map(m => (m === pending ? msg : m));
      }
      return [...list, msg];
    });

    if (isMine || wasNearBottom) {
      setTimeout(() => this.scrollToBottom(), 0);
    } else {
      this.hasNewBelow.set(true);
    }
    if (!isMine) {
      this.otherTyping.set(false);
      this.markRead();
    }
  }

  /** Draft changed: let the other side know we're typing (throttled). */
  onDraftInput() {
    const now = Date.now();
    if (!this.subscription || !this.newMessage.trim() || now - this.lastTypingSentAt < TYPING_SEND_INTERVAL_MS) return;
    this.lastTypingSentAt = now;
    this.messagesService.sendTyping(this.subscription, this.currentUserId());
  }

  private onOtherTyping(from: string) {
    if (this.otherUserId && from !== this.otherUserId) return;
    this.otherTyping.set(true);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.otherTyping.set(false), TYPING_DISPLAY_MS);
  }

  private refreshOnline() {
    this.otherOnline.set(!!this.otherUserId && this.onlineIds.includes(this.otherUserId));
  }

  /** The recipient read one of our messages: flip its tick to "read". */
  private onUpdated(msg: Message) {
    if (!msg?.id || msg.conversation_id !== this.conversationId || !msg.read) return;
    this.messages.update(list => list.map(m => (m.id === msg.id && !m.read ? { ...m, read: true } : m)));
  }

  /** Marks the thread read (refreshing the navbar badge) — deferred while the tab is hidden. */
  private markRead() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.pendingRead = true;
      return;
    }
    this.pendingRead = false;
    this.messagesService.markAsRead(this.conversationId).catch(() => { /* badge refreshes on next event */ });
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!event.repeat) this.send();
    }
  }

  onScroll() {
    if (this.hasNewBelow() && this.isNearBottom()) this.hasNewBelow.set(false);
  }

  jumpToLatest() {
    this.hasNewBelow.set(false);
    this.scrollToBottom();
  }

  async deleteConversation() {
    if (this.isDeleting()) return;
    if (!confirm('¿Borrar esta conversación? Se eliminarán todos los mensajes.')) return;
    this.isDeleting.set(true);
    try {
      const err = await this.messagesService.deleteConversation(this.conversationId);
      if (err) { this.sendError.set(err); return; }
      this.router.navigate(['/inbox']);
    } catch {
      this.sendError.set('No se pudo eliminar la conversación.');
    } finally {
      this.isDeleting.set(false);
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    // Cursor = oldest stored message. Offsets drift as realtime/optimistic messages
    // are appended, which duplicated or skipped history.
    const oldest = this.messages().find(m => !m.id.startsWith(TEMP_PREFIX));
    this.loadingMore.set(true);
    const el = this.messagesList?.nativeElement;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const { messages: older, hasMore } = await this.messagesService.getMessages(
        this.conversationId,
        this.MESSAGES_LIMIT,
        oldest?.created_at,
      );
      this.messages.update(list => {
        const ids = new Set(list.map(m => m.id));
        return [...older.filter(m => !ids.has(m.id)), ...list];
      });
      this.hasMore.set(hasMore);
      // Keep the viewport anchored on the message the user was reading.
      if (el) setTimeout(() => { el.scrollTop = el.scrollHeight - prevHeight + prevTop; }, 0);
    } catch {
      this.sendError.set('No se pudieron cargar mensajes anteriores. Inténtalo de nuevo.');
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

  /** Merges fetched rows with ones already shown (realtime / optimistic), deduped by id. */
  private merge(fetched: Message[], current: ChatMessage[]): ChatMessage[] {
    const ids = new Set(fetched.map(m => m.id));
    return [...fetched, ...current.filter(m => !ids.has(m.id))].sort(byCreatedAt);
  }

  private isNearBottom(): boolean {
    const el = this.messagesList?.nativeElement;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  private scrollToBottom() {
    const el = this.messagesList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
    this.hasNewBelow.set(false);
  }
}
