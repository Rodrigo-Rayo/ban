import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationsService } from '../../core/services/notifications.service';
import { Notification as AppNotification } from '../../core/models';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

export interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

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
  deleting = signal(false);

  constructor() {
    // React to new real-time notifications while the page is open.
    // The Navbar keeps the Supabase channel alive; this effect piggybacks on
    // the latestNotification signal that the service sets on each INSERT.
    effect(() => {
      const n = this.notifSvc.latestNotification();
      if (!n || this.loading()) return;
      // Guard against duplicates (e.g. signal fires before ngOnInit completes)
      if (this.notifications().some(x => x.id === n.id)) return;
      // The user is actively looking at the page — show it as already read
      this.notifications.update(list => [{ ...n, read: true }, ...list]);
      // Keep the DB and the unread badge in sync
      const uid = this.userId();
      if (uid) this.notifSvc.markAllRead(uid);
    }, { allowSignalWrites: true });
  }

  /** Notifications grouped into Today / Yesterday / Last 7 days / Earlier. */
  groupedNotifications = computed<NotificationGroup[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const thisWeek: AppNotification[] = [];
    const earlier: AppNotification[] = [];

    for (const n of this.notifications()) {
      const d = new Date(n.created_at);
      if (d >= startOfToday) today.push(n);
      else if (d >= startOfYesterday) yesterday.push(n);
      else if (d >= startOfWeek) thisWeek.push(n);
      else earlier.push(n);
    }

    const groups: NotificationGroup[] = [];
    if (today.length)     groups.push({ label: 'Hoy',              items: today });
    if (yesterday.length) groups.push({ label: 'Ayer',             items: yesterday });
    if (thisWeek.length)  groups.push({ label: 'Últimos 7 días',   items: thisWeek });
    if (earlier.length)   groups.push({ label: 'Anteriores',       items: earlier });
    return groups;
  });

  hasUnread = computed(() => this.notifications().some(n => !n.read));

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      application:    'music',
      message:        'message',
      review:         'star',
      booking:        'calendar',
      rsvp:           'calendar',
      event_reminder: 'calendar',
      favorite:       'heart',
      system:         'info',
      info:           'info',
    };
    return map[type] ?? 'bell';
  }

  getRoute(n: AppNotification): string[] | null {
    if (n.type === 'message') {
      return n.entity_type === 'conversation' && n.entity_id
        ? ['/inbox', n.entity_id]
        : ['/inbox'];
    }
    if (!n.entity_type || !n.entity_id) return null;
    const map: Record<string, string> = {
      musician:  '/musicians',
      band:      '/bands',
      venue:     '/venues',
      event:     '/events',
      teacher:   '/teachers',
      rehearsal: '/rehearsal',
    };
    if (!map[n.entity_type]) return null;
    return [map[n.entity_type], n.entity_id];
  }

  async markAllRead() {
    const uid = this.userId();
    if (!uid) return;
    await this.notifSvc.markAllRead(uid);
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  async deleteAll() {
    const uid = this.userId();
    if (!uid) return;
    this.deleting.set(true);
    await this.notifSvc.deleteAll(uid);
    this.notifications.set([]);
    this.deleting.set(false);
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
      // silently ignore load errors — list stays empty
    } finally {
      this.loading.set(false);
    }
  }
}
