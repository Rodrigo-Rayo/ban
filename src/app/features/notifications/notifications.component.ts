import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { NotificationsService } from '../../core/services/notifications.service';
import { ToastService } from '../../core/services/toast.service';
import { Notification as AppNotification } from '../../core/models';
import { SupabaseService } from '../../core/services/supabase.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { timeAgo } from '../../core/utils/display.utils';
import { IconComponent } from '../../shared/components/icon/icon.component';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitelist of entity types that link to a detail page (`<base>/<uuid>`). */
const ENTITY_ROUTES: Readonly<Record<string, string>> = {
  musician: '/musicians', band: '/bands', venue: '/venues',
  event: '/events', teacher: '/teachers', rehearsal: '/rehearsal',
  gear: '/shop', post: '/posts', conversation: '/inbox',
};

/** IconComponent name per notification type; anything else gets the bell. */
const TYPE_ICONS: Readonly<Record<string, string>> = {
  application: 'mic', favorite: 'heart', booking: 'book-open', rsvp: 'calendar',
  review: 'star', message: 'message', event_reminder: 'calendar', quedada: 'star',
};

@Component({
    selector: 'app-notifications',
    imports: [RouterLink, NgTemplateOutlet, IconComponent],
    templateUrl: './notifications.component.html'
})
export class NotificationsComponent implements OnInit {
  private notifSvc = inject(NotificationsService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  readonly timeAgo = timeAgo;

  loading = signal(true);
  deleting = signal(false);
  notifications = signal<AppNotification[]>([]);
  userId = signal<string | null>(null);

  readonly hasUnread = computed(() => this.notifications().some(n => !n.read));
  readonly unreadTotal = computed(() => this.notifications().filter(n => !n.read).length);

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
    const previous = this.notifications();
    this.notifications.update(ns => ns.map(n => ({ ...n, read: true })));
    try {
      await this.notifSvc.markAllRead(uid);
    } catch {
      this.notifications.set(previous); // roll back the optimistic update
      this.toast.error('No se pudo marcar como leído.');
    }
  }

  async deleteAll() {
    const uid = this.userId();
    if (!uid) return;
    const ok = await this.confirm.ask({
      title: 'Eliminar todas las notificaciones',
      message: 'Se borrarán para siempre. No se puede deshacer.',
      confirmLabel: 'Eliminar todas',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.notifSvc.deleteAll(uid);
      this.notifications.set([]);
    } catch {
      this.toast.error('No se pudieron eliminar las notificaciones.');
    } finally {
      this.deleting.set(false);
    }
  }

  getRoute(n: AppNotification): string[] | null {
    const hasValidId = !!n.entity_id && UUID_RE.test(n.entity_id);
    if (n.type === 'quedada') return ['/quedada'];
    if (n.type === 'message') {
      return n.entity_type === 'conversation' && hasValidId
        ? ['/inbox', n.entity_id!]
        : ['/inbox'];
    }
    if (!n.entity_type || !hasValidId) return null;
    const base = Object.prototype.hasOwnProperty.call(ENTITY_ROUTES, n.entity_type)
      ? ENTITY_ROUTES[n.entity_type]
      : null;
    return base ? [base, n.entity_id!] : null;
  }

  iconFor(n: AppNotification): string {
    return Object.prototype.hasOwnProperty.call(TYPE_ICONS, n.type) ? TYPE_ICONS[n.type] : 'bell';
  }

  /** Tapping a notification: shows it as read right away; the routerLink does the navigation. */
  open(n: AppNotification) {
    const uid = this.userId();
    if (n.read || !uid) return;
    this.notifications.update(ns => ns.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    this.notifSvc.markRead(uid, n.id).catch(() => undefined); // page load already marked all read
  }

  async ngOnInit() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) { this.loading.set(false); return; }
      this.userId.set(session.user.id);
      const notifs = await this.notifSvc.getAll(session.user.id);
      this.notifications.set(notifs);
    } catch {
      this.toast.error('No se pudieron cargar las notificaciones. Recarga la página.');
      return;
    } finally {
      this.loading.set(false);
    }
    // Opening the page counts as "seen": clear the navbar badge. Items keep their
    // unread styling for this visit. Failure is non-fatal (badge stays accurate).
    await this.notifSvc.markAllRead(this.userId()!).catch(() => { /* badge keeps the real count */ });
  }
}
