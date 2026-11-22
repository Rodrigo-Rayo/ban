import { Injectable } from '@angular/core';

/**
 * Carries pending registration credentials from the register page to onboarding.
 * Uses in-memory storage only — credentials are never written to sessionStorage or
 * localStorage, which means they are not accessible to other browser tabs, extensions,
 * or scripts that might read persistent storage.
 *
 * The data lives only for the current page session and is cleared immediately after
 * the Supabase signUp call completes.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationStateService {
  private _email = '';
  private _password = '';
  private _captchaToken: string | undefined;

  /** `captchaToken`: Turnstile token from the register page (single-use, ~5 min). */
  set(email: string, password: string, captchaToken?: string) {
    this._email = email;
    this._password = password;
    this._captchaToken = captchaToken;
  }

  get hasPending(): boolean {
    return !!this._email;
  }

  get email(): string {
    return this._email;
  }

  get password(): string {
    return this._password;
  }

  get captchaToken(): string | undefined {
    return this._captchaToken;
  }

  clear() {
    this._email = '';
    this._password = '';
    this._captchaToken = undefined;
  }
}
