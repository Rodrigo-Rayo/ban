import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';


@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth: {
        // Use implicit flow for email-based auth (password reset, magic links).
        // PKCE requires a code_verifier stored in localStorage, which breaks when
        // the email link opens in a different browser context (Gmail app, Chrome
        // Custom Tab, incognito). Implicit flow delivers the token in the URL
        // hash and works across all browser contexts.
        flowType: 'implicit',
        // Bypass Navigator Locks API — in a PWA the service worker already
        // holds the exclusive lock, so the new page instance fails immediately
        // and can't read the auth session. Single-tab PWAs don't need
        // cross-tab lock synchronisation.
        lock: async (_name: string, _timeout: number, fn: () => Promise<unknown>) => fn(),
      } as any,
    });
  }

  get client() {
    return this.supabase;
  }

  get auth() {
    return this.supabase.auth;
  }

  authChanges(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  /** `captchaToken` is only sent when given (Supabase requires it once Turnstile is on). */
  signInWithEmail(email: string, password: string, captchaToken?: string) {
    return this.supabase.auth.signInWithPassword(
      captchaToken ? { email, password, options: { captchaToken } } : { email, password },
    );
  }

  signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>, captchaToken?: string) {
    const options = { ...(metadata ? { data: metadata } : {}), ...(captchaToken ? { captchaToken } : {}) };
    return this.supabase.auth.signUp({ email, password, options: Object.keys(options).length ? options : undefined });
  }

  resetPasswordForEmail(email: string, captchaToken?: string) {
    return this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
      ...(captchaToken ? { captchaToken } : {}),
    });
  }

  signInWithGoogle() {
    return this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
  }

  signOut() {
    // Log out this device only; the default ('global') also kills the user's
    // sessions on every other phone/computer.
    return this.supabase.auth.signOut({ scope: 'local' });
  }

  getSession() {
    return this.supabase.auth.getSession();
  }
}
