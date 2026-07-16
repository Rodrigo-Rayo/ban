import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RegistrationStateService {
  private _email: string | null = null;
  private _password: string | null = null;

  set(email: string, password: string) {
    this._email = email;
    this._password = password;
  }

  get hasPending(): boolean { return !!this._email; }
  get email(): string { return this._email!; }
  get password(): string { return this._password!; }

  clear() {
    this._email = null;
    this._password = null;
  }
}
