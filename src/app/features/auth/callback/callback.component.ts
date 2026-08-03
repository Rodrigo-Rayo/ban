import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `
    <div class="min-h-screen bg-dark-900 flex items-center justify-center">
      <svg class="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  async ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    // Detect OAuth/Supabase error in query string
    const oauthError = params.get('error');
    if (oauthError) {
      this.router.navigate(['/auth/login'], {
        queryParams: { error: params.get('error_description') || oauthError },
      });
      return;
    }

    const hash = new URLSearchParams(window.location.hash.substring(1));

    // Detect error in hash (implicit-flow error)
    const hashError = hash.get('error');
    if (hashError) {
      this.router.navigate(['/auth/login'], {
        queryParams: { error: hash.get('error_description') || hashError },
      });
      return;
    }

    // Implicit flow: token delivered in URL hash (type=recovery for password resets).
    // detectSessionInUrl auto-establishes the session before ngOnInit runs.
    const isHashRecovery = hash.get('type') === 'recovery';
    if (isHashRecovery) {
      this.router.navigate(['/auth/reset-password']);
      return;
    }

    if (code) {
      // PKCE flow (Google OAuth). Listen for the auth event before exchanging.
      let handled = false;
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(async (event, session) => {
        if (handled) return;
        handled = true;
        subscription.unsubscribe();
        if (session) { await this.redirect(session.user.id); }
        else { this.router.navigate(['/auth/login']); }
      });
      const { error } = await this.supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (!handled) { handled = true; subscription.unsubscribe(); }
        this.router.navigate(['/auth/login']);
      }
      return;
    }

    // Implicit flow OAuth: session auto-established from hash, no code param.
    const { data: { session } } = await this.supabase.getSession();
    if (session) {
      await this.redirect(session.user.id);
      return;
    }

    this.router.navigate(['/auth/login']);
  }

  private async redirect(userId: string) {
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    this.router.navigate([profile?.role ? '/home' : '/onboarding']);
  }
}
