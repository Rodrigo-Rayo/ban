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
    // Wait for Supabase to process the OAuth code from the URL
    const { data: { session } } = await this.supabase.getSession();

    if (!session) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Check if this user already has a profile
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile) {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/onboarding']);
    }
  }
}
