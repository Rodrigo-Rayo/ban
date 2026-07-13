import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { InstallBannerComponent } from './shared/components/install-banner/install-banner.component';
import { CookieBannerComponent } from './shared/components/cookie-banner/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, ToastComponent, InstallBannerComponent, CookieBannerComponent],
  template: `
    <app-navbar />
    <app-sidebar />
    <div class="lg:pl-56">
      <router-outlet />
    </div>
    <app-toast />
    <app-install-banner />
    <app-cookie-banner />
  `,
})
export class AppComponent {
  private router = inject(Router);
  private scroller = inject(ViewportScroller);

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.scroller.scrollToPosition([0, 0]));
  }
}
