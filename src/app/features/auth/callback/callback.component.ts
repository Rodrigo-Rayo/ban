import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Subscription as SupabaseSubscription } from '@supabase/supabase-js';

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
export class CallbackComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private sub: SupabaseSubscription | null = null;

  async ngOnInit() {
    console.log('[Callback] ngOnInit — URL:', window.location.href);

    // First try: session may already be available if Supabase exchanged the code
    const { data: { session } } = await this.supabase.getSession();
    console.log('[Callback] getSession result:', session ? `user=${session.user.id}` : 'null');

    if (session) {
      await this.redirect(session.user.id, 'getSession');
      return;
    }

    // Second try: wait for auth event (PKCE code exchange in progress)
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Callback] onAuthStateChange event:', event, 'session:', session ? session.user.id : 'null');
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        this.sub = subscription;
        await this.redirect(session.user.id, event);
      }
    });
    this.sub = subscription;

    // Fallback: if nothing happens in 5 seconds, send to login
    setTimeout(() => {
      if (this.sub) {
        console.log('[Callback] TIMEOUT — no auth event received, going to login');
        this.sub.unsubscribe();
        this.sub = null;
        this.router.navigate(['/auth/login']);
      }
    }, 5000);
  }

  private async redirect(userId: string, source: string) {
    console.log('[Callback] redirect() called from:', source, 'userId:', userId);
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
    const { data: profile, error } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    console.log('[Callback] profile check:', profile, 'error:', error);
    const dest = profile ? '/home' : '/onboarding';
    console.log('[Callback] navigating to:', dest);
    this.router.navigate([dest]);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
