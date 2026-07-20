import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { PushNotificationService } from './push-notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private _signingOut = false;
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private push = inject(PushNotificationService);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this._session());
  readonly userProfileType = signal<string>('');
  readonly userProfileData = signal<any>(null);

  constructor() {
    this.supabase.getSession()
      .then(({ data }) => { this._session.set(data.session); })
      .catch(() => {});

    this.supabase.authChanges((event, session) => {
      this._session.set(session);
      // Redirect to login on unexpected sign-out (e.g. token refresh failure),
      // but not when our own signOut() method triggered it.
      if (event === 'SIGNED_OUT' && !this._signingOut) {
        this.router.navigate(['/auth/login']);
      }
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

  async loadUserProfile(userId: string): Promise<void> {
    // Try localStorage first (fast path)
    try {
      const cached = localStorage.getItem('bandyou_profile_type');
      if (cached) this.userProfileType.set(cached);
    } catch {}

    const tables = [
      { table: 'musicians', type: 'musician' },
      { table: 'bands', type: 'band' },
      { table: 'venues', type: 'venue' },
      { table: 'teachers', type: 'teacher' },
      { table: 'rehearsal_spaces', type: 'rehearsal' },
    ] as const;

    const results = await Promise.all(
      tables.map(({ table, type }) =>
        this.supabase.client.from(table)
          .select('id, name, city, avatar_url')
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data }: { data: any }) => data ? { data, type } : null)
      )
    );
    const found = results.find(r => r !== null);
    if (found) {
      this.userProfileType.set(found.type);
      this.userProfileData.set(found.data);
      try { localStorage.setItem('bandyou_profile_type', found.type); } catch {}
      try { localStorage.setItem('bandyou_city', found.data.city || ''); } catch {}
    }
  }

  clearUserProfile() {
    this.userProfileType.set('');
    this.userProfileData.set(null);
    try { localStorage.removeItem('bandyou_profile_type'); } catch {}
  }

  async signOut() {
    this._signingOut = true;
    const userId = this.user()?.id;
    if (userId) {
      try { await this.push.unsubscribeDevice(userId); } catch { /* ignore */ }
    }
    this.clearUserProfile();
    try { await this.supabase.signOut(); } catch { /* ignore */ }
    this._signingOut = false;
    this.router.navigate(['/']);
  }
}
