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
    // First try: session may already be available if Supabase exchanged the code
    const { data: { session } } = await this.supabase.getSession();
    if (session) {
      await this.redirect(session.user.id);
      return;
    }

    // Second try: wait for SIGNED_IN event (PKCE code exchange in progress)
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.sub = subscription;
        await this.redirect(session.user.id);
      }
    });
    this.sub = subscription;

    // Fallback: if nothing happens in 5 seconds, send to login
    setTimeout(() => {
      if (this.sub) {
        this.sub.unsubscribe();
        this.sub = null;
      }
      this.router.navigate(['/auth/login']);
    }, 5000);
  }

  private async redirect(userId: string) {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    this.router.navigate([profile ? '/home' : '/onboarding']);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
