import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessagesService } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe],
  templateUrl: './inbox.component.html',
})
export class InboxComponent implements OnInit {
  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private destroyRef = inject(DestroyRef);

  conversations = signal<any[]>([]);
  names = signal<Record<string, string>>({});
  unreadIds = signal<Set<string>>(new Set());
  loading = signal(true);
  deleteError = signal('');

  async ngOnInit() {
    const convs = await this.messagesService.getConversations();
    this.conversations.set(convs);

    const [nameEntries, unreadIds] = await Promise.all([
      Promise.all(convs.map(async conv => [conv.id, await this.messagesService.getOtherUserProfile(conv)] as const)),
      this.messagesService.getUnreadConversationIds(),
    ]);
    this.names.set(Object.fromEntries(nameEntries));
    this.unreadIds.set(unreadIds);
    this.loading.set(false);

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
      this.deleteError.set('No se pudo borrar la conversación. Puede que necesites permisos adicionales en la base de datos.');
      setTimeout(() => this.deleteError.set(''), 5000);
      return;
    }
    this.conversations.update(convs => convs.filter(c => c.id !== id));
    this.unreadIds.update(set => { set.delete(id); return new Set(set); });
  }

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];

  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }

}
