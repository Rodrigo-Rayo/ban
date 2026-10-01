import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessagesService, InboxUpdate } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { Conversation } from '../../core/models';
import { avatarColor } from '../../core/utils/display.utils';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe],
  templateUrl: './inbox.component.html',
})
export class InboxComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);

  conversations = signal<Conversation[]>([]);
  names = signal<Record<string, string>>({});
  unreadIds = signal<Set<string>>(new Set());
  loading = signal(true);
  deleteError = signal('');
  deletingId = signal<string | null>(null);

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

  async deleteConversation(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.deletingId()) return;
    if (!confirm('¿Borrar esta conversación? Se eliminarán todos los mensajes para ambos participantes.')) return;
    this.deletingId.set(id);
    try {
      const err = await this.messagesService.deleteConversation(id);
      if (err) {
        this.toast.error('No se pudo borrar la conversación. Inténtalo de nuevo.');
        return;
      }
      this.conversations.update(convs => convs.filter(c => c.id !== id));
      this.unreadIds.update(set => new Set([...set].filter(existingId => existingId !== id)));
      this.toast.success('Conversación eliminada.');
    } catch {
      this.toast.error('No se pudo borrar la conversación. Inténtalo de nuevo.');
    } finally {
      this.deletingId.set(null);
    }
  }

}
