import { Injectable, signal, computed, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { PushNotificationService } from './push-notification.service';

interface UserProfileData {
  id: string;
  name: string;
  city: string;
  avatar_url: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private _signingOut = false;
  private _loadedUserId: string | null = null;
  private _roleVerifiedFor: string | null = null;
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private push = inject(PushNotificationService);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this._session());
  readonly userProfileType = signal<string>('');
  readonly userProfileData = signal<UserProfileData | null>(null);

  constructor() {
    // Remember where a visitor was when any action sends them to /auth/login
    // (favorite, message, apply…), so login returns them there instead of /home.
    // authGuard stores the attempted protected URL first; that one wins.
    this.router.events.subscribe(e => {
      if (!(e instanceof NavigationStart)) return;
      // Leaving the login page without signing in: forget the stale return URL.
      if (this.router.url.startsWith('/auth/login') && !e.url.startsWith('/auth')) {
        try { sessionStorage.removeItem('bandyou_return_url'); } catch { /* storage blocked */ }
        return;
      }
      if (!e.url.startsWith('/auth/login')) return;
      const from = this.router.url;
      if (from === '/' || from.startsWith('/auth') || from.startsWith('/onboarding')) return;
      try {
        if (!sessionStorage.getItem('bandyou_return_url')) sessionStorage.setItem('bandyou_return_url', from);
      } catch { /* storage blocked */ }
    });

    this.supabase.getSession()
      .then(({ data }) => { this._session.set(data.session); })
      .catch(() => {});

    this.supabase.authChanges((event, session) => {
      this._session.set(session);
      // Recovery links: supabase-js may consume the URL hash before /auth/callback
      // reads it, so rely on its event to always land on the new-password form.
      if (event === 'PASSWORD_RECOVERY') {
        this.router.navigate(['/auth/reset-password']);
        return;
      }
      // Redirect to login on unexpected sign-out (e.g. token refresh failure),
      // but not when our own signOut() method triggered it.
      if (event === 'SIGNED_OUT' && !this._signingOut) {
        this.clearUserProfile();
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
    // Skip if already loaded for this user
    if (this.userProfileData() && this._loadedUserId === userId) return;
    this._loadedUserId = userId;

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
          .then(({ data }: { data: UserProfileData | null }) => data ? { data, type } : null)
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

  /** True when the guard already confirmed this user has a profile role in the current session. */
  isRoleVerified(userId: string): boolean {
    return this._roleVerifiedFor === userId;
  }

  markRoleVerified(userId: string): void {
    this._roleVerifiedFor = userId;
  }

  clearUserProfile() {
    this._roleVerifiedFor = null;
    this.userProfileType.set('');
    this.userProfileData.set(null);
    this._loadedUserId = null;
    try { localStorage.removeItem('bandyou_profile_type'); } catch {}
    try { localStorage.removeItem('bandyou_city'); } catch {}
  }

  async signOut() {
    this._signingOut = true;
    const userId = this.user()?.id;
    if (userId) {
      // Never let push cleanup block logging out (it depends on the service worker).
      await Promise.race([
        this.push.unsubscribeDevice(userId).catch(() => undefined),
        new Promise(resolve => setTimeout(resolve, 2500)),
      ]);
    }
    this.clearUserProfile();
    try { await this.supabase.signOut(); } catch { /* ignore */ }
    this._signingOut = false;
    this.router.navigate(['/']);
  }

  async deleteAccount(): Promise<void> {
    // Set flag BEFORE the RPC so the SIGNED_OUT auth event (fired when
    // auth.users is deleted) does not trigger the unexpected-signout redirect.
    this._signingOut = true;
    try {
      const { error } = await this.supabase.client.rpc('delete_user_account');
      if (error) throw new Error(error.message);
      // auth.users is gone, so a server sign-out would fail — but the session must
      // still be dropped locally, or the app keeps acting as logged in.
      await this.supabase.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      this._session.set(null);
      this.clearUserProfile();
      this.router.navigate(['/']);
    } finally {
      this._signingOut = false;
    }
  }
}
