import { Component, inject, effect, signal } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';
import { IconComponent } from './shared/components/icon/icon.component';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { InstallBannerComponent } from './shared/components/install-banner/install-banner.component';
import { CookieBannerComponent } from './shared/components/cookie-banner/cookie-banner.component';
import { NotificationPermissionBannerComponent } from './shared/components/notification-permission-banner/notification-permission-banner.component';
import { AuthService } from './core/services/auth.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { SeoService } from './core/services/seo.service';
import { INSTAGRAM_URL } from './core/constants/social';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, IconComponent, NavbarComponent, ConfirmDialogComponent, ToastComponent, InstallBannerComponent, CookieBannerComponent, NotificationPermissionBannerComponent],
    template: `
    <app-navbar />
    <main id="main-content" tabindex="-1" class="pb-16 lg:pb-0">
      <router-outlet />
      @if (showFooter()) {
        <footer class="border-t-2 border-ink mt-8 px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center sm:justify-between"
                [class.pb-24]="hasActionBar()" [class.sm:pb-6]="hasActionBar()">
          <div class="flex items-center justify-between sm:justify-start gap-3">
            <span class="font-display text-2xl uppercase leading-none">Band<span class="text-primary-500">You</span></span>
            <a [href]="instagramUrl" target="_blank" rel="noopener noreferrer" aria-label="Instagram de BandYou (se abre en una pestaña nueva)" title="Instagram" class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-ink-muted hover:text-primary-500 transition-colors"><app-icon name="instagram" [size]="24"/></a>
          </div>
<nav aria-label="Explorar" class="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] font-bold uppercase text-ink-muted">
            <a href="/busco-banda" class="hover:text-ink min-h-[44px] inline-flex items-center">Busco banda</a>
            <a href="/busco-musicos" class="hover:text-ink min-h-[44px] inline-flex items-center">Busco músicos</a>
            <a href="/locales-de-ensayo" class="hover:text-ink min-h-[44px] inline-flex items-center">Locales de ensayo</a>
            <a href="/clases-de-musica" class="hover:text-ink min-h-[44px] inline-flex items-center">Clases</a>
            <a href="/guias" class="hover:text-ink min-h-[44px] inline-flex items-center">Guías</a>
          </nav>
          <nav aria-label="Legal" class="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] font-bold uppercase text-ink-muted">
            <a routerLink="/legal/aviso-legal" class="hover:text-ink min-h-[44px] inline-flex items-center">Aviso legal</a>
            <a routerLink="/legal/privacidad" class="hover:text-ink min-h-[44px] inline-flex items-center">Privacidad</a>
            <a routerLink="/legal/terminos" class="hover:text-ink min-h-[44px] inline-flex items-center">Términos</a>
            <a routerLink="/legal/cookies" class="hover:text-ink min-h-[44px] inline-flex items-center">Cookies</a>
          </nav>
        </footer>
      }
    </main>
    <app-toast />
    <app-confirm-dialog />
    <app-install-banner />
    <app-notification-permission-banner />
    <app-cookie-banner />
  `
})
export class AppComponent {
  readonly instagramUrl = INSTAGRAM_URL;
  private router = inject(Router);
  private scroller = inject(ViewportScroller);
  auth = inject(AuthService);
  private push = inject(PushNotificationService);
  // Eager: its router listener must exist before the first NavigationEnd so
  // route-level noindex applies even on pages that never call seo.set().
  private seo = inject(SeoService);

  private lastPath: string | null = null;
  /** The landing has its own footer and the chat is a full-height panel. */
  showFooter = signal(false);
  /** Profile/detail pages pin an action bar above the bottom nav on mobile; the footer must clear it. */
  hasActionBar = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        // Only react to real page changes: query-param updates (search typing,
        // filters) must not steal focus, and the first load keeps the skip link first.
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        this.showFooter.set(path !== '/' && !path.startsWith('/inbox/'));
        this.hasActionBar.set(/^\/(posts|events|shop|musicians|bands|venues|teachers|rehearsal)\/(?!new$|create$)[^/]+$/.test(path));
        const isFirst = this.lastPath === null;
        const pathChanged = path !== this.lastPath;
        this.lastPath = path;
        if (isFirst || !pathChanged) return;
        this.scroller.scrollToPosition([0, 0]);
        const main = document.getElementById('main-content');
        if (main) main.focus({ preventScroll: true });
      });

    // The bottom nav exists for every visitor below lg; fixed bars offset from it via CSS.
    document.body.classList.add('has-bottom-nav');

    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.push.subscribe(user.id);
      }
    });
  }
}
