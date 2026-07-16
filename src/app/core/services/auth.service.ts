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

    this.supabase.authChanges(async (event, session) => {
      this._session.set(session);
      if (event === 'SIGNED_IN' && session) {
        if (localStorage.getItem('bandyou_needs_onboarding') === 'true') {
          localStorage.removeItem('bandyou_needs_onboarding');
          this.router.navigate(['/onboarding']);
        } else if (session.user.app_metadata?.['provider'] !== 'email') {
          // OAuth user (Google, etc.) — redirect to onboarding if no profile yet
          const { data } = await this.supabase.client
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();
          if (!data) {
            this.router.navigate(['/onboarding']);
          }
        }
      }
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
    const userId = this.user()?.id;
    if (userId) {
      try { await this.push.unsubscribeDevice(userId); } catch { /* ignore */ }
    }
    try { await this.supabase.signOut(); } catch { /* ignore */ }
    this.router.navigate(['/']);
  }
}
