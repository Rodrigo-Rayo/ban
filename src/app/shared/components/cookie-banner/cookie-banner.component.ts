import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The app only uses strictly necessary storage (session, login flow, UI
 * preferences the user chose), which is exempt from consent under LSSI-CE
 * art. 22.2 and the AEPD cookie guide. The banner is therefore purely
 * informational: a single "Entendido" dismiss, no accept/reject choice that
 * would change nothing. If non-essential storage (analytics, ads, embeds) is
 * ever added, this must become a real consent banner with equally prominent
 * accept / reject / configure options, and that storage must stay off until
 * the user accepts.
 */
export const COOKIE_NOTICE_KEY = 'bandyou_cookie_consent';

@Component({
    selector: 'app-cookie-banner',
    imports: [RouterLink],
    templateUrl: './cookie-banner.component.html'
})
export class CookieBannerComponent implements OnInit {
  visible = signal(false);

  ngOnInit(): void {
    this.visible.set(!this.readDismissed());
  }

  dismiss(): void {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, 'acknowledged');
    } catch {
      // Storage blocked (private mode / site data disabled): hide for this page view only.
    }
    this.visible.set(false);
  }

  private readDismissed(): boolean {
    try {
      // Any stored value (including legacy 'accepted' / 'rejected') means the notice was seen.
      return !!localStorage.getItem(COOKIE_NOTICE_KEY);
    } catch {
      return false;
    }
  }
}
