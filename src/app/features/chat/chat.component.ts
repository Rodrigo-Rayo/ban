import { Component, inject, signal, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
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
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
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
  private subscription: any;
  private conversationId = '';

  async ngOnInit() {
    this.conversationId = this.route.snapshot.paramMap.get('id')!;

    // Use name passed from profile navigation immediately (no flicker)
    const navName = history.state?.name;
    if (navName) this.otherName.set(navName);

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

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  async send() {
    const content = this.newMessage.trim();
    if (!content) return;
    this.newMessage = '';
    const msg = await this.messagesService.sendMessage(this.conversationId, content);
    if (msg) {
      this.messages.update(msgs =>
        msgs.some(m => m.id === msg.id) ? msgs : [...msgs, msg]
      );
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
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }
}
