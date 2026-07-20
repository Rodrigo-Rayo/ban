import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationsService } from '../../core/services/notifications.service';
import { Notification as AppNotification } from '../../core/models';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe, IconComponent],
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnInit {
  private notifSvc = inject(NotificationsService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  loading = signal(true);
  notifications = signal<AppNotification[]>([]);
  userId = signal<string | null>(null);

  typeIcon(type: string) {
    const map: Record<string, string> = {
      application: 'music',
      message:     'message',
      review:      'star',
      booking:     'calendar',
      info:        'info',
    };
    return map[type] || 'bell';
  }

  getRoute(n: any): any[] | null {
    if (n.type === 'message') {
      return n.entity_type === 'conversation' && n.entity_id
        ? ['/inbox', n.entity_id]
        : ['/inbox'];
    }
    if (!n.entity_type || !n.entity_id) return null;
    const map: Record<string, string> = {
      musician: '/musicians', band: '/bands', venue: '/venues',
      event: '/events', teacher: '/teachers', rehearsal: '/rehearsal',
    };
    if (!map[n.entity_type]) return null;
    return [map[n.entity_type], n.entity_id];
  }

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) { this.loading.set(false); return; }
    this.userId.set(session.user.id);
    try {
      const notifs = await this.notifSvc.getAll(session.user.id);
      this.notifications.set(notifs);
      await this.notifSvc.markAllRead(session.user.id);
    } catch {
    } finally {
      this.loading.set(false);
    }
  }
}
