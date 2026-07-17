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

    // Detect password recovery from implicit-flow hash
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery = hash.get('type') === 'recovery';

    if (code) {
      const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);
      if (data?.session) {
        await this.redirect(data.session.user.id);
        return;
      }
      if (error) {
        this.router.navigate(['/auth/login']);
        return;
      }
    }

    // No code — session may already exist (implicit flow auto-detected from hash)
    const { data: { session } } = await this.supabase.getSession();
    if (session) {
      if (isRecovery) {
        this.router.navigate(['/auth/reset-password']);
        return;
      }
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
