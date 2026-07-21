import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationsService } from '../../core/services/notifications.service';
import { ToastService } from '../../core/services/toast.service';
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
  private toast = inject(ToastService);

  loading = signal(true);
  deleting = signal(false);
  notifications = signal<AppNotification[]>([]);
  userId = signal<string | null>(null);

  readonly hasUnread = computed(() => this.notifications().some(n => !n.read));

  readonly groupedNotifications = computed(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const week = new Date(today); week.setDate(today.getDate() - 7);

    const groups: { label: string; items: AppNotification[] }[] = [
      { label: 'Hoy', items: [] },
      { label: 'Ayer', items: [] },
      { label: 'Últimos 7 días', items: [] },
      { label: 'Anteriores', items: [] },
    ];

    for (const n of this.notifications()) {
      const d = new Date(n.created_at);
      if (d >= today) groups[0].items.push(n);
      else if (d >= yesterday) groups[1].items.push(n);
      else if (d >= week) groups[2].items.push(n);
      else groups[3].items.push(n);
    }
    return groups.filter(g => g.items.length > 0);
  });

  async markAllRead() {
    const uid = this.userId();
    if (!uid) return;
    this.notifications.update(ns => ns.map(n => ({ ...n, read: true })));
    await this.notifSvc.markAllRead(uid);
  }

  async deleteAll() {
    const uid = this.userId();
    if (!uid) return;
    this.deleting.set(true);
    try {
      await this.notifSvc.deleteAll(uid);
      this.notifications.set([]);
    } catch {
      this.toast.error('No se pudieron borrar las notificaciones.');
    } finally {
      this.deleting.set(false);
    }
  }

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
      this.toast.error('No se pudieron cargar las notificaciones. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }
}
