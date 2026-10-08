import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { needsOnboarding } from '../../../core/utils/profile-check';
import { readEmailLink } from './email-link';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `
    <div class="min-h-screen bg-dark-900 flex flex-col items-center justify-center gap-3" role="status">
      <svg aria-hidden="true" class="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink">Entrando…</p>
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

    // Our own email templates link to bandyou.es with a token_hash (better for spam
    // filters than a link to the Supabase domain): verify it here.
    const emailLink = readEmailLink(window.location.search);
    if (emailLink) {
      const { data, error } = await this.supabase.auth.verifyOtp({ token_hash: emailLink.tokenHash, type: emailLink.type });
      if (error || !data.session) {
        this.router.navigate(['/auth/login'], {
          queryParams: { error: 'El enlace ha caducado o ya se usó. Pide uno nuevo.' },
        });
        return;
      }
      if (emailLink.type === 'recovery') this.router.navigate(['/auth/reset-password']);
      else await this.redirect(data.session.user.id);
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
    // A failed lookup (null) must not send an existing user back through onboarding;
    // authGuard re-checks on the next protected route anyway.
    if (await needsOnboarding(this.supabase.client, userId) === true) {
      this.router.navigate(['/onboarding']);
      return;
    }
    let returnUrl: string | null = null;
    try {
      returnUrl = sessionStorage.getItem('bandyou_return_url');
      sessionStorage.removeItem('bandyou_return_url');
    } catch { /* storage blocked */ }
    // Same rule as AuthService.signInWithEmail: only in-app relative paths.
    if (returnUrl && /^\/[^/]/.test(returnUrl)) this.router.navigateByUrl(returnUrl);
    else this.router.navigate(['/home']);
  }
}
