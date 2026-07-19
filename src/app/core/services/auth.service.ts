import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { PushNotificationService } from './push-notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private push = inject(PushNotificationService);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this._session());

  constructor() {
    this.supabase.getSession()
      .then(({ data }) => { this._session.set(data.session); })
      .catch(() => {});

    this.supabase.authChanges((event, session) => {
      this._session.set(session);
    });
  }

  async signInWithEmail(email: string, password: string) {
    const { error } = await this.supabase.signInWithEmail(email, password);
    if (error) throw error;
    try {
      const returnUrl = sessionStorage.getItem('bandyou_return_url');
      // Only allow relative paths (no protocol-relative or absolute URLs)
      if (returnUrl && /^\/[^/]/.test(returnUrl)) {
        sessionStorage.removeItem('bandyou_return_url');
        this.router.navigateByUrl(returnUrl);
        return;
      } else if (returnUrl) {
        sessionStorage.removeItem('bandyou_return_url');
      }
    } catch {}
    this.router.navigate(['/home']);
  }

  async signUpWithEmail(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await this.supabase.signUpWithEmail(email, password);
    if (error) throw error;
    if (data.session) {
      // Email confirmation disabled — user is immediately authenticated
      this.router.navigate(['/onboarding']);
      return { needsConfirmation: false };
    }
    // Email confirmation required — caller shows "revisa tu email"
    return { needsConfirmation: true };
  }

  async signInWithGoogle() {
    const { error } = await this.supabase.signInWithGoogle();
    if (error) throw error;
  }

  async signOut() {
    const userId = this.user()?.id;
    if (userId) {
      try { await this.push.unsubscribeDevice(userId); } catch { /* ignore */ }
    }
    try { await this.supabase.signOut(); } catch { /* ignore */ }
    this.router.navigate(['/']);
  }
}
