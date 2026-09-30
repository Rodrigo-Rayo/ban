import { Component, inject, signal, effect, untracked, OnInit, OnDestroy, DestroyRef, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  private channel: RealtimeChannel | null = null;
  private notifChannel: RealtimeChannel | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private currentUserId: string | null = null;

  constructor() {
    // Realtime channels, unread badges and avatar follow the signed-in user, so
    // an in-app login/logout (no page reload) sets them up / tears them down.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => this.onUserChange(userId));
    });
  }

  ngOnInit() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.publishOpen = false;
    });
  }

  private async onUserChange(userId: string | null) {
    if (userId === this.currentUserId) return;
    this.teardownRealtime();
    this.currentUserId = userId;
    if (!userId) return;

    try {
      await this.messagesService.refreshUnreadCount();
      if (this.currentUserId !== userId) return; // user changed while awaiting
      this.loadAvatar(userId).catch(() => {});
      this.channel = this.messagesService.subscribeToInboxUpdates(
        userId,
        (senderName, preview, convId) => {
          this.messagesService.inboxUpdate$.next({ senderName, preview, conversationId: convId });
          if (this.messagesService.activeChatConversationId() === convId) return;
          this.messagesService.unreadCount.update(n => n + 1);
          this.showToast(senderName, preview, convId);
        }
      );
      await this.notifSvc.loadUnread(userId);
      if (this.currentUserId !== userId) return;
      this.notifChannel = this.notifSvc.subscribe(userId, () => {});
    } catch {
      // Navbar errors are non-fatal — app continues to render without realtime features
    }
  }

  private teardownRealtime() {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    this.channel = null;
    this.notifSvc.unsubscribe();
    this.notifChannel = null;
    this.avatarUrl.set(null);
    this.messagesService.unreadCount.set(0);
    this.notifSvc.unreadCount.set(0);
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
    this.teardownRealtime();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
}
