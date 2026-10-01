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

  signInWithEmail(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>) {
    return this.supabase.auth.signUp({ email, password, options: metadata ? { data: metadata } : undefined });
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
    return this.supabase.auth.signOut();
  }

  getSession() {
    return this.supabase.auth.getSession();
  }
}
