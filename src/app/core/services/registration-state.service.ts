import { Injectable } from '@angular/core';

const KEY_EMAIL = 'bandyou_reg_email';
const KEY_PW    = 'bandyou_reg_pw';

@Injectable({ providedIn: 'root' })
export class RegistrationStateService {
  set(email: string, password: string) {
    try {
      sessionStorage.setItem(KEY_EMAIL, email);
      sessionStorage.setItem(KEY_PW, password);
    } catch { /* private mode */ }
  }

  get hasPending(): boolean {
    try { return !!sessionStorage.getItem(KEY_EMAIL); } catch { return false; }
  }

  get email(): string {
    try { return sessionStorage.getItem(KEY_EMAIL) ?? ''; } catch { return ''; }
  }

  get password(): string {
    try { return sessionStorage.getItem(KEY_PW) ?? ''; } catch { return ''; }
  }

  clear() {
    try {
      sessionStorage.removeItem(KEY_EMAIL);
      sessionStorage.removeItem(KEY_PW);
    } catch { /* ignore */ }
  }
}
