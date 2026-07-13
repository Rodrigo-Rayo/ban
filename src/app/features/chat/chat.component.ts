import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagesService } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './chat.component.html',
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);

  messages = signal<any[]>([]);
  otherName = signal('');
  newMessage = '';
  currentUserId = '';
  loading = signal(true);
  sending = signal(false);
  private subscription: any;
  private conversationId = '';

  constructor() {
    // Scroll to bottom only when message count changes, not on every CD cycle
    effect(() => {
      const count = this.messages().length;
      if (count > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  async ngOnInit() {
    this.conversationId = this.route.snapshot.paramMap.get('id')!;

    const navName = history.state?.name;
    if (navName && typeof navName === 'string') this.otherName.set(navName);

    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUserId = user?.id || '';

    const [msgs, conv] = await Promise.all([
      this.messagesService.getMessages(this.conversationId),
      this.messagesService.getConversationById(this.conversationId),
    ]);
    this.messages.set(msgs);
    await this.messagesService.markAsRead(this.conversationId);

    if (conv) {
      const resolved = await this.messagesService.getOtherUserProfile(conv);
      if (resolved && resolved !== 'Usuario') this.otherName.set(resolved);
    }

    this.loading.set(false);

    this.subscription = this.messagesService.subscribeToMessages(
      this.conversationId,
      (msg) => {
        this.messages.update(msgs =>
          msgs.some(m => m.id === msg.id) ? msgs : [...msgs, msg]
        );
        this.messagesService.markAsRead(this.conversationId);
      }
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
  }

  sendError = signal('');

  async send() {
    const content = this.newMessage.trim();
    if (!content || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    const msg = await this.messagesService.sendMessage(this.conversationId, content);
    this.sending.set(false);
    if (msg) {
      this.newMessage = '';
      this.messages.update(msgs =>
        msgs.some(m => m.id === msg.id) ? msgs : [...msgs, msg]
      );
    } else {
      this.sendError.set('No se pudo enviar. Inténtalo de nuevo.');
      setTimeout(() => this.sendError.set(''), 3000);
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
    await this.messagesService.deleteConversation(this.conversationId);
    this.router.navigate(['/inbox']);
  }

  private scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'auto' });
    } catch {}
  }
}
