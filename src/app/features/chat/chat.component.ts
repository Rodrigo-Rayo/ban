import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
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
  @ViewChild('messagesList') private messagesList!: ElementRef;

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
  sendError = signal('');
  private subscription: any;
  private conversationId = '';

  async ngOnInit() {
    this.conversationId = this.route.snapshot.paramMap.get('id')!;
    this.messagesService.setActiveChat(this.conversationId);

    const navName = history.state?.name;
    if (navName && typeof navName === 'string') this.otherName.set(navName);

    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUserId = user?.id || '';

    const [msgs, conv] = await Promise.all([
      this.messagesService.getMessages(this.conversationId),
      this.messagesService.getConversationById(this.conversationId),
    ]);
    this.messages.set(msgs);

    // Scroll after Angular renders the message list
    setTimeout(() => this.scrollToBottom(), 0);

    await this.messagesService.markAsRead(this.conversationId);

    if (conv) {
      const resolved = await this.messagesService.getOtherUserProfile(conv);
      if (resolved && resolved !== 'Usuario') this.otherName.set(resolved);
    }

    this.loading.set(false);

    this.subscription = this.messagesService.subscribeToMessages(
      this.conversationId,
      (msg) => {
        this.messages.update(list =>
          list.some(m => m.id === msg.id) ? list : [...list, msg]
        );
        setTimeout(() => this.scrollToBottom(), 0);
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
    await this.messagesService.deleteConversation(this.conversationId);
    this.router.navigate(['/inbox']);
  }

  private scrollToBottom() {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
