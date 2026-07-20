import { Component, inject, signal, OnInit, OnDestroy, DestroyRef, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, IconComponent],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  notifSvc = inject(NotificationsService);
  messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  menuOpen = false;
  publishOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.publishOpen && !(event.target as Element).closest('[data-publish-dropdown]')) {
      this.publishOpen = false;
    }
  }
  avatarUrl = signal<string | null>(null);
  toast = signal<{ name: string; preview: string; conversationId: string } | null>(null);
  private channel: any = null;
  private notifChannel: any = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      await this.messagesService.refreshUnreadCount();
      this.loadAvatar(session.user.id);
      this.channel = this.messagesService.subscribeToInboxUpdates(
        session.user.id,
        (senderName, preview, convId) => {
          this.messagesService.inboxUpdate$.next({ senderName, preview, conversationId: convId });
          if (this.messagesService.activeChatConversationId() === convId) return;
          this.messagesService.unreadCount.update(n => n + 1);
          this.showToast(senderName, preview, convId);
        }
      );
      await this.notifSvc.loadUnread(session.user.id);
      this.notifChannel = this.notifSvc.subscribe(session.user.id, () => {});
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.publishOpen = false;
    });
  }

  private async loadAvatar(userId: string) {
    const { data } = await this.supabase.client.rpc('get_profile_avatar', { p_user_id: userId });
    if (data) this.avatarUrl.set(data as string);
  }

  private showToast(name: string, preview: string, conversationId: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ name, preview, conversationId });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }

  goToChat() {
    const t = this.toast();
    this.toast.set(null);
    if (t?.conversationId) {
      this.router.navigate(['/inbox', t.conversationId], { state: { name: t.name } });
      setTimeout(() => this.messagesService.refreshUnreadCount(), 600);
    }
  }

  ngOnDestroy() {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    this.notifSvc.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
}
