import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { InstallBannerComponent } from './shared/components/install-banner/install-banner.component';
import { CookieBannerComponent } from './shared/components/cookie-banner/cookie-banner.component';
import { NotificationPermissionBannerComponent } from './shared/components/notification-permission-banner/notification-permission-banner.component';
import { AuthService } from './core/services/auth.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { SeoService } from './core/services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, ToastComponent, InstallBannerComponent, CookieBannerComponent, NotificationPermissionBannerComponent],
  template: `
    <app-navbar />
    <app-sidebar />
    <main id="main-content" tabindex="-1" class="lg:pl-56 pb-16 md:pb-0">
      <router-outlet />
    </main>
    <app-toast />
    <app-install-banner />
    <app-notification-permission-banner />
    <app-cookie-banner />
  `,
})
export class AppComponent {
  private router = inject(Router);
  private scroller = inject(ViewportScroller);
  private auth = inject(AuthService);
  private push = inject(PushNotificationService);
  // Eager: its router listener must exist before the first NavigationEnd so
  // route-level noindex applies even on pages that never call seo.set().
  private seo = inject(SeoService);

  private lastPath: string | null = null;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        // Only react to real page changes: query-param updates (search typing,
        // filters) must not steal focus, and the first load keeps the skip link first.
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        const isFirst = this.lastPath === null;
        const pathChanged = path !== this.lastPath;
        this.lastPath = path;
        if (isFirst || !pathChanged) return;
        this.scroller.scrollToPosition([0, 0]);
        const main = document.getElementById('main-content');
        if (main) main.focus({ preventScroll: true });
      });

    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.push.subscribe(user.id);
      }
    });
  }
}
