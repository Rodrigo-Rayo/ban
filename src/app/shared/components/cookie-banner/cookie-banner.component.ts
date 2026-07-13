import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

const CONSENT_KEY = 'bandyou_cookie_consent';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
})
export class CookieBannerComponent implements OnInit {
  visible = signal(false);

  ngOnInit(): void {
    if (!localStorage.getItem(CONSENT_KEY)) {
      this.visible.set(true);
    }
  }

  accept(): void {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    this.visible.set(false);
  }

  reject(): void {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    this.visible.set(false);
  }
}
