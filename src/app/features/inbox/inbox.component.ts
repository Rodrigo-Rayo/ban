import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessagesService } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';
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

  conversations = signal<any[]>([]);
  names = signal<Record<string, string>>({});
  unreadIds = signal<Set<string>>(new Set());
  loading = signal(true);
  deleteError = signal('');

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
    } finally {
      this.loading.set(false);
    }

    // Reuse the navbar's shared subscription instead of creating a second channel
    this.messagesService.inboxUpdate$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ senderName, preview, conversationId: convId }) => {
      this.conversations.update(convs => {
        const idx = convs.findIndex(c => c.id === convId);
        const updated = { ...(convs[idx] ?? { id: convId }), last_message: preview, last_message_at: new Date().toISOString() };
        const rest = convs.filter(c => c.id !== convId);
        return [updated, ...rest];
      });
      this.unreadIds.update(set => new Set([...set, convId]));
      if (!this.names()[convId]) {
        this.names.update(n => ({ ...n, [convId]: senderName }));
      }
    });
  }

  async deleteConversation(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm('¿Borrar esta conversación? Se eliminarán todos los mensajes para ambos participantes.')) return;
    const err = await this.messagesService.deleteConversation(id);
    if (err) {
      this.deleteError.set('No se pudo borrar la conversación. Inténtalo de nuevo.');
      setTimeout(() => this.deleteError.set(''), 5000);
      return;
    }
    this.conversations.update(convs => convs.filter(c => c.id !== id));
    this.unreadIds.update(set => { set.delete(id); return new Set(set); });
  }

}
