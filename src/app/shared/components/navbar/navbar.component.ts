import { Component, inject, signal, computed, effect, untracked, OnInit, OnDestroy, DestroyRef, HostListener, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SeoService } from '../../../core/services/seo.service';
import { AvatarUploadService } from '../../../core/services/avatar-upload.service';
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
  { label: 'Se busca', link: '/feed' },
  { label: 'Músicos',  link: '/search', query: { tab: 'musicians' } },
  { label: 'Bandas',   link: '/search', query: { tab: 'bands' } },
  { label: 'Locales',  link: '/search', query: { tab: 'rehearsal' } },
  { label: 'Clases',   link: '/search', query: { tab: 'teachers' } },
  { label: 'Agenda',   link: '/search', query: { tab: 'events' } },
  { label: 'Salas',    link: '/search', query: { tab: 'venues' } },
  { label: 'Tienda',   link: '/shop' },
];

/** Content to publish (first group of the sheet). */
export const PUBLISH_CONTENT: readonly PublishOption[] = [
  { label: 'Anuncio en Se busca', hint: 'Busco banda, músicos, colaboración…', icon: 'newspaper',      link: '/feed', query: { new: '1' } },
  { label: 'Evento',              hint: 'Bolo, jam session, festival',          icon: 'calendar',      link: '/events/create' },
  { label: 'Vender equipo',       hint: 'Instrumentos, amplis, efectos',        icon: 'shopping-cart', link: '/shop/new' },
];

/** Professional profiles to create (second group of the sheet). */
export const PUBLISH_PROFILES: readonly PublishOption[] = [
  { label: 'Dar clases',         hint: 'Perfil de profesor',          icon: 'book-open',  link: '/teachers/new' },
  { label: 'Local de ensayo',    hint: 'Alquila tu local por horas',  icon: 'headphones', link: '/rehearsal/new' },
  { label: 'Sala de conciertos', hint: 'Programa música en directo',  icon: 'building',   link: '/venues/new' },
];

/** "Vacante en tu banda": only for band profiles, straight to the band's page. */
export function bandVacancyOption(profileType: string, profileId: string | null | undefined): PublishOption | null {
  if (profileType !== 'band') return null;
  return {
    label: 'Vacante en tu banda',
    hint: 'Desde el perfil de tu banda',
    icon: 'users',
    link: profileId ? `/bands/${profileId}` : '/dashboard',
  };
}

/** First letter shown on the avatar: the profile name wins over the email. */
export function accountInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? '').trim() || (email ?? '').trim() || 'U';
  return source.slice(0, 1).toUpperCase();
}

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
  private avatarUpload = inject(AvatarUploadService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private _menuOpen = false;
  /** While the mobile menu is open the page behind it is inert, so Tab can't wander under the panel. */
  get menuOpen(): boolean { return this._menuOpen; }
  set menuOpen(open: boolean) {
    this._menuOpen = open;
    this.host.nativeElement.ownerDocument.getElementById('main-content')?.toggleAttribute('inert', open);
  }
  publishOpen = false;
  accountOpen = false;
  readonly sections = NAV_SECTIONS;
  readonly publishProfiles = PUBLISH_PROFILES;
  /** Content group, plus the band vacancy when the user has a band profile. */
  readonly publishItems = computed<readonly PublishOption[]>(() => {
    const vacancy = bandVacancyOption(this.auth.userProfileType(), this.auth.userProfileData()?.id);
    return vacancy ? [...PUBLISH_CONTENT, vacancy] : PUBLISH_CONTENT;
  });
  readonly accountName = computed(() => this.auth.userProfileData()?.name?.trim() || '');
  readonly initial = computed(() => accountInitial(this.accountName(), this.auth.user()?.email));
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
    this.accountOpen = false;
    if (this.publishOpen) this.focusFirst('#publish-menu');
  }

  toggleAccount() {
    this.accountOpen = !this.accountOpen;
    this.publishOpen = false;
    if (this.accountOpen) this.focusFirst('#account-menu');
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    this.publishOpen = false;
    this.accountOpen = false;
  }

  closeAll() {
    this.publishOpen = false;
    this.menuOpen = false;
    this.accountOpen = false;
  }

  signOut() {
    this.closeAll();
    this.auth.signOut();
  }

  /** Moves focus into a freshly opened menu (once Angular has rendered it). */
  private focusFirst(selector: string) {
    setTimeout(() => this.host.nativeElement.ownerDocument
      .querySelector<HTMLElement>(`${selector} [role="menuitem"]`)?.focus());
  }

  /** Returns focus to the (visible) control that opened a menu. */
  private focusTrigger(selector: string) {
    const doc = this.host.nativeElement.ownerDocument;
    Array.from(doc.querySelectorAll<HTMLElement>(selector)).find(el => el.offsetParent !== null)?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.accountOpen) { this.accountOpen = false; this.focusTrigger('[data-account-trigger]'); }
    if (this.publishOpen) { this.publishOpen = false; this.focusTrigger('[data-publish-trigger]'); }
    if (this.menuOpen) { this.menuOpen = false; this.focusTrigger('[data-menu-trigger]'); }
  }

  /** Arrow keys / Home / End move between menu items; Tab leaves the menu. */
  onMenuKeydown(event: KeyboardEvent) {
    const menu = event.currentTarget as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(event.target as HTMLElement);
    const go = (n: number) => { event.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
    switch (event.key) {
      case 'ArrowDown': go(i + 1); break;
      case 'ArrowUp': go(i - 1); break;
      case 'Home': go(0); break;
      case 'End': go(items.length - 1); break;
      case 'Tab': {
        const trigger = this.publishOpen ? '[data-publish-trigger]' : '[data-account-trigger]';
        event.preventDefault();
        this.accountOpen = false;
        this.publishOpen = false;
        this.focusTrigger(trigger);
        break;
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Element;
    if (this.publishOpen && !target.closest('[data-publish-dropdown]')) this.publishOpen = false;
    if (this.accountOpen && !target.closest('[data-account-menu]')) this.accountOpen = false;
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
    // A photo changed anywhere (Mi panel, Portada, own profile) shows up right away.
    effect(() => {
      const url = this.avatarUpload.avatarUrl();
      if (url) untracked(() => this.avatarUrl.set(url));
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
      this.closeAll();
      this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
    });
  }

  private async onUserChange(userId: string | null) {
    if (userId === this.currentUserId) return;
    this.teardownRealtime();
    this.currentUserId = userId;
    if (!userId) return;

    // Each step is independent: one failing (e.g. the notifications count) must not
    // leave the inbox channel or the other badge un-initialised. Notifications start
    // first so a slow messages request can never delay the bell badge.
    const notifications = this.setupNotifications(userId);
    this.auth.loadUserProfile(userId).catch(() => { /* the initial falls back to the email */ });
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
    await notifications;
  }

  /** Bell badge: initial unread count, then live updates over Realtime. */
  private async setupNotifications(userId: string) {
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

  /** Shown next to the search box; the shortcut works on both platforms. */
  readonly shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent) {
    if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey) return;
    event.preventDefault();
    this.router.navigate(['/search']).then(() =>
      setTimeout(() => document.querySelector<HTMLInputElement>('main input[type="search"]')?.focus()));
  }

  /**
   * Badges can drift when another tab/device reads messages or notifications;
   * re-sync whenever this tab becomes visible again.
   */
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
