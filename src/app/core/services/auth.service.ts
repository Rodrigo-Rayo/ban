import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this._session());

  constructor(private supabase: SupabaseService, private router: Router) {
    this.supabase.getSession()
      .then(({ data }) => { this._session.set(data.session); })
      .catch(() => {});

    this.supabase.authChanges((_, session) => {
      this._session.set(session);
    });
  }

  async signInWithEmail(email: string, password: string) {
    const { error } = await this.supabase.signInWithEmail(email, password);
    if (error) throw error;
    this.router.navigate(['/home']);
  }

  async signUpWithEmail(email: string, password: string) {
    const { error } = await this.supabase.signUpWithEmail(email, password);
    if (error) throw error;
  }

  async signInWithGoogle() {
    const { error } = await this.supabase.signInWithGoogle();
    if (error) throw error;
  }

  async signOut() {
    try { await this.supabase.signOut(); } catch { /* ignore */ }
    this.router.navigate(['/']);
  }
}
