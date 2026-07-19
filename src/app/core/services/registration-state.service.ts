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

  set(email: string, password: string) {
    this._email = email;
    this._password = password;
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

  clear() {
    this._email = '';
    this._password = '';
  }
}
