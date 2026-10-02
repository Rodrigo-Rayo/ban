import { Component, inject, signal, effect, untracked, OnInit, OnDestroy, DestroyRef, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SeoService } from '../../../core/services/seo.service';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../icon/icon.component';
import { environment } from '../../../../environments/environment';

/** How long the new-message toast stays up (paused while hovered or focused). */
const MESSAGE_TOAST_MS = 6000;

/** Badging API (installed PWA icon). Unsupported browsers simply ignore it. */
function setAppBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const op = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  op?.catch(() => { /* not permitted outside an installed app */ });
}

/** A top-level section of the site (one name per concept, see docs/design). */
export interface NavSection { label: string; link: string; query?: Record<string, string>; }
/** One way to publish something, listed in the single "Publicar" sheet. */
export interface PublishOption { label: string; hint: string; icon: string; link: string; query?: Record<string, string>; }

export const NAV_SECTIONS: readonly NavSection[] = [
  { label: 'Agenda',   link: '/search', query: { tab: 'events' } },
  { label: 'Se busca', link: '/search', query: { tab: 'vacancies' } },
  { label: 'Músicos',  link: '/search', query: { tab: 'musicians' } },
  { label: 'Bandas',   link: '/search', query: { tab: 'bands' } },
  { label: 'Locales',  link: '/search', query: { tab: 'rehearsal' } },
  { label: 'Salas',    link: '/search', query: { tab: 'venues' } },
  { label: 'Clases',   link: '/search', query: { tab: 'teachers' } },
  { label: 'Tienda',   link: '/shop' },
  { label: 'Anuncios', link: '/feed' },
];

export const PUBLISH_OPTIONS: readonly PublishOption[] = [
  { label: 'Anuncio',          hint: 'Busco banda, músicos, colaboración…', icon: 'newspaper',     link: '/feed', query: { new: '1' } },
  { label: 'Concierto',        hint: 'Bolo, jam session, festival',          icon: 'calendar',      link: '/events/create' },
  { label: 'Vender equipo',    hint: 'Instrumentos, amplis, efectos',        icon: 'shopping-cart', link: '/shop/new' },
  { label: 'Vacante en tu banda', hint: 'Desde el perfil de tu banda',       icon: 'users',         link: '/dashboard' },
  { label: 'Dar clases',       hint: 'Perfil de profesor',                   icon: 'book-open',     link: '/teachers/new' },
  { label: 'Local de ensayo',  hint: 'Alquila tu local por horas',           icon: 'headphones',    link: '/rehearsal/new' },
  { label: 'Sala de conciertos', hint: 'Programa música en directo',         icon: 'building',      link: '/venues/new' },
];

@Component({
    selector: 'app-navbar',
    imports: [RouterLink, RouterLinkActive, IconComponent],
    templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  notifSvc = inject(NotificationsService);
  messagesService = inject(MessagesService);
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  menuOpen = false;
  publishOpen = false;
  readonly sections = NAV_SECTIONS;
  readonly publishOptions = PUBLISH_OPTIONS;
  /** Current URL, to mark the active section (search tabs differ only by query). */
  private currentUrl = signal(this.router.url);

  isActive(s: NavSection): boolean {
    const tree = this.router.parseUrl(this.currentUrl());
    const path = '/' + (tree.root.children['primary']?.segments.map(x => x.path).join('/') ?? '');
    if (path !== s.link) return false;
    return !s.query || Object.entries(s.query).every(([k, v]) => tree.queryParams[k] === v)
      || (s.query['tab'] === 'musicians' && !tree.queryParams['tab']);
  }

  togglePublish() {
    this.publishOpen = !this.publishOpen;
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.publishOpen = false;
    this.menuOpen = false;
  }

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
  private toastHeld = false;

  private currentUserId: string | null = null;

  constructor() {
    // Realtime channels, unread badges and avatar follow the signed-in user, so
    // an in-app login/logout (no page reload) sets them up / tears them down.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => this.onUserChange(userId));
    });
    // Unread messages show in the tab title and on the installed app's icon.
    effect(() => {
      const unread = this.messagesService.unreadCount();
      untracked(() => {
        this.seo.setUnreadCount(unread);
        setAppBadge(unread);
      });
    });
  }

  ngOnInit() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this.publishOpen = false;
      this.menuOpen = false;
      this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
    });
  }

  private async onUserChange(userId: string | null) {
    if (userId === this.currentUserId) return;
    this.teardownRealtime();
    this.currentUserId = userId;
    if (!userId) return;

    // Each step is independent: one failing (e.g. the notifications count) must not
    // leave the inbox channel or the other badge un-initialised.
    await this.messagesService.refreshUnreadCount(); // keeps previous value on error
    if (this.currentUserId !== userId) return; // user changed while awaiting
    this.loadAvatar(userId).catch(() => {});
    try {
      this.channel = this.messagesService.subscribeToInboxUpdates(
        userId,
        (senderName, preview, convId) => {
          if (this.currentUserId !== userId) return;
          this.messagesService.inboxUpdate$.next({ senderName, preview, conversationId: convId });
          if (this.messagesService.activeChatConversationId() === convId) return;
          this.messagesService.unreadCount.update(n => n + 1);
          this.showToast(senderName, preview, convId);
        }
      );
    } catch (err) {
      if (!environment.production) console.error('[navbar] inbox channel failed:', err);
    }
    try {
      await this.notifSvc.loadUnread(userId);
    } catch (err) {
      if (!environment.production) console.error('[navbar] notifications count failed:', err);
    }
    if (this.currentUserId !== userId) return;
    try {
      this.notifChannel = this.notifSvc.subscribe(userId, () => {});
    } catch (err) {
      if (!environment.production) console.error('[navbar] notifications channel failed:', err);
    }
  }

  /**
   * Badges can drift when another tab/device reads messages or notifications;
   * re-sync whenever this tab becomes visible again.
   */
  /** Shown next to the search box; the shortcut works on both platforms. */
  readonly shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent) {
    if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey) return;
    event.preventDefault();
    this.router.navigate(['/search']).then(() =>
      setTimeout(() => document.querySelector<HTMLInputElement>('main input[type="search"]')?.focus()));
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    const userId = this.currentUserId;
    if (!userId || document.visibilityState !== 'visible') return;
    this.messagesService.refreshUnreadCount();
    this.notifSvc.loadUnread(userId).catch(() => { /* keep previous count */ });
  }

  private teardownRealtime() {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    this.channel = null;
    this.notifSvc.unsubscribe();
    this.notifChannel = null;
    this.avatarUrl.set(null);
    this.dismissToast();
    this.messagesService.unreadCount.set(0);
    this.notifSvc.unreadCount.set(0);
  }

  private async loadAvatar(userId: string) {
    const { data } = await this.supabase.client.rpc('get_profile_avatar', { p_user_id: userId });
    if (data) this.avatarUrl.set(data as string);
  }

  private showToast(name: string, preview: string, conversationId: string) {
    this.toast.set({ name, preview, conversationId });
    this.scheduleToastDismiss();
  }

  private scheduleToastDismiss() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    if (this.toastHeld) return; // never auto-dismiss while hovered/focused (WCAG 2.2.1)
    this.toastTimer = setTimeout(() => this.dismissToast(), MESSAGE_TOAST_MS);
  }

  /** Pause auto-dismiss while the pointer or keyboard focus is on the toast. */
  holdToast(held: boolean) {
    this.toastHeld = held;
    if (held) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = null;
    } else if (this.toast()) {
      this.scheduleToastDismiss();
    }
  }

  dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toastHeld = false;
    this.toast.set(null);
  }

  goToChat() {
    const t = this.toast();
    this.dismissToast();
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
