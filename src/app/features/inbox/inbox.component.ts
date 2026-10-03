import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessagesService, InboxUpdate } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Conversation } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { avatarSrc } from '../../core/utils/display.utils';
import { fetchProfileAvatar, initialOf } from './profile-avatar';

const PUSH_NOTICE_DISMISSED_KEY = 'bandyou_push_notice_dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(PUSH_NOTICE_DISMISSED_KEY) === '1'; } catch { return false; }
}

/** What the "enable notifications" strip should offer on this device. */
export type PushPrompt = 'none' | 'ask' | 'denied' | 'ios-install';

function detectPushPrompt(permission: NotificationPermission | 'unsupported', swEnabled: boolean): PushPrompt {
  if (permission === 'unsupported' || !swEnabled) {
    // iOS only exposes Web Push to apps added to the home screen.
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
    return isIos && !standalone ? 'ios-install' : 'none';
  }
  if (permission === 'default') return 'ask';
  if (permission === 'denied') return 'denied';
  return 'none';
}

@Component({
    selector: 'app-inbox',
    imports: [RouterLink, CommonModule, DatePipe],
    templateUrl: './inbox.component.html'
})
export class InboxComponent implements OnInit {
  readonly avatarSrc = avatarSrc;
  readonly initialOf = initialOf;

  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);
  private push = inject(PushNotificationService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);

  conversations = signal<Conversation[]>([]);
  names = signal<Record<string, string>>({});
  /** Photo of the other participant per conversation id (absent = letter fallback). */
  avatars = signal<Record<string, string>>({});
  unreadIds = signal<Set<string>>(new Set());
  loading = signal(true);
  deleteError = signal('');
  deletingId = signal<string | null>(null);
  pushPrompt = signal<PushPrompt>(detectPushPrompt(this.push.permission, this.push.isSupported));
  enablingPush = signal(false);
  /** The "blocked / install" notice was closed by the user (remembered on this device). */
  pushNoticeDismissed = signal(readDismissed());

  async ngOnInit() {
    try {
      const convs = await this.messagesService.getConversations();
      this.conversations.set(convs);

      const [nameEntries, unreadIds] = await Promise.all([
        Promise.all(convs.map(async conv => [conv.id, await this.messagesService.getOtherUserProfile(conv)] as const)),
        this.messagesService.getUnreadConversationIds(),
      ]);
      this.names.set(Object.fromEntries(nameEntries));
      this.unreadIds.set(unreadIds);
      void this.loadAvatars(convs);
    } catch {
      this.toast.error('No se pudieron cargar las conversaciones. Recarga la página.');
    } finally {
      this.loading.set(false);
    }

    // Reuse the navbar's shared subscription instead of creating a second channel.
    // Events are already filtered to the user's own conversations by the service.
    this.messagesService.inboxUpdate$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => this.onInboxUpdate(update));
  }

  private otherUserId(conv: Conversation): string {
    return conv.user1_id === this.auth.user()?.id ? conv.user2_id : conv.user1_id;
  }

  private async loadAvatars(convs: Conversation[]) {
    const entries = await Promise.all(convs.map(async c => [c.id, await fetchProfileAvatar(this.supabase, this.otherUserId(c))] as const));
    const found = entries.filter((e): e is readonly [string, string] => !!e[1]);
    if (found.length) this.avatars.update(a => ({ ...a, ...Object.fromEntries(found) }));
  }

  dismissPushNotice() {
    this.pushNoticeDismissed.set(true);
    try { localStorage.setItem(PUSH_NOTICE_DISMISSED_KEY, '1'); } catch { /* private mode: closed for this visit only */ }
  }

  private onInboxUpdate({ senderName, preview, conversationId: convId }: InboxUpdate) {
    const known = this.conversations().some(c => c.id === convId);
    this.conversations.update(convs => {
      const existing = convs.find(c => c.id === convId);
      if (!existing) return convs;
      const updated = { ...existing, last_message: preview, last_message_at: new Date().toISOString() };
      return [updated, ...convs.filter(c => c.id !== convId)];
    });
    this.unreadIds.update(set => new Set([...set, convId]));
    if (!this.names()[convId]) {
      this.names.update(n => ({ ...n, [convId]: senderName }));
    }
    // A brand-new thread started by the other user: fetch the real row so the
    // list item has participant ids (needed for names / deletion), not a stub.
    if (!known) {
      this.messagesService.getConversationById(convId).then(conv => {
        if (!conv || this.conversations().some(c => c.id === convId)) return;
        this.conversations.update(convs => [{ ...conv, last_message: preview, last_message_at: conv.last_message_at ?? new Date().toISOString() }, ...convs]);
      }).catch(() => { /* list refreshes on next visit */ });
    }
  }

  async enablePush() {
    const userId = this.auth.user()?.id;
    if (!userId || this.enablingPush()) return;
    this.enablingPush.set(true);
    const result = await this.push.requestAndSubscribe(userId);
    this.enablingPush.set(false);
    if (result === 'granted') {
      this.pushPrompt.set('none');
      this.toast.success('Notificaciones activadas.');
    } else if (result === 'denied') {
      this.pushPrompt.set('denied');
    } else {
      this.toast.error('No se pudieron activar las notificaciones. Inténtalo de nuevo.');
    }
  }

  async deleteConversation(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.deletingId()) return;
    const ok = await this.confirm.ask({
      title: '¿Eliminar esta conversación?',
      message: 'Se borrarán todos los mensajes para ambos participantes.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deletingId.set(id);
    try {
      const err = await this.messagesService.deleteConversation(id);
      if (err) {
        this.toast.error('No se pudo eliminar la conversación. Inténtalo de nuevo.');
        return;
      }
      this.conversations.update(convs => convs.filter(c => c.id !== id));
      this.unreadIds.update(set => new Set([...set].filter(existingId => existingId !== id)));
      this.toast.success('Conversación eliminada.');
    } catch {
      this.toast.error('No se pudo eliminar la conversación. Inténtalo de nuevo.');
    } finally {
      this.deletingId.set(null);
    }
  }

}
