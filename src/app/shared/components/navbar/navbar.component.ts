import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  notifSvc = inject(NotificationsService);
  private messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  menuOpen = false;
  publishOpen = false;
  unread = signal(0);
  avatarUrl = signal<string | null>(null);
  toast = signal<{ name: string; preview: string } | null>(null);
  private channel: any = null;
  private notifChannel: any = null;
  private toastTimer: any = null;

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      this.unread.set(await this.messagesService.getUnreadCount());
      this.loadAvatar(session.user.id);
      this.channel = this.messagesService.subscribeToInboxUpdates(
        session.user.id,
        (senderName, preview, _convId) => {
          this.unread.update(n => n + 1);
          this.showToast(senderName, preview);
        }
      );
      await this.notifSvc.loadUnread(session.user.id);
      this.notifChannel = this.notifSvc.subscribe(session.user.id, () => {});
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(async (e: any) => {
      this.publishOpen = false;
      if (e.url.startsWith('/inbox')) {
        this.unread.set(0);
      }
      if (e.url.startsWith('/notifications')) {
        this.notifSvc.unreadCount.set(0);
      }
      if (e.url.startsWith('/dashboard')) {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) this.loadAvatar(session.user.id);
      }
    });
  }

  private async loadAvatar(userId: string) {
    const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
    for (const table of tables) {
      const { data } = await this.supabase.client
        .from(table).select('avatar_url').eq('user_id', userId).maybeSingle();
      if (data?.avatar_url) { this.avatarUrl.set(data.avatar_url); return; }
    }
  }

  private showToast(name: string, preview: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ name, preview });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }

  goToInbox() {
    this.toast.set(null);
    this.router.navigate(['/inbox']);
  }

  ngOnDestroy() {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    this.notifSvc.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
}
