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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, ToastComponent, InstallBannerComponent, CookieBannerComponent, NotificationPermissionBannerComponent],
  template: `
    <app-navbar />
    <app-sidebar />
    <div class="lg:pl-56 pb-16 md:pb-0">
      <router-outlet />
    </div>
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

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.scroller.scrollToPosition([0, 0]));

    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.push.subscribe(user.id);
      }
    });
  }
}
