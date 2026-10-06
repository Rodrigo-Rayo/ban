import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { needsOnboarding } from '../utils/profile-check';

export const PROFILE_REQUIRED_MESSAGE = 'Crea tu perfil para escribir, guardar o publicar. Sin perfil solo puedes mirar.';

/**
 * Without a profile you can only look: every action (messages, favorites, posts,
 * reviews, La quedada…) first asks this gate. Missing profile → onboarding.
 * The database enforces the same rule (supabase/2026_10_require_profile.sql);
 * this is the friendly front door.
 */
@Injectable({ providedIn: 'root' })
export class ProfileGateService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private toast = inject(ToastService);
  /** Users already known to have a profile (a profile is never removed without leaving). */
  private confirmed = new Set<string>();

  /**
   * True when the signed-in user has a profile (or nobody is signed in: login flows
   * handle that). False after showing the message (unless `toast: false`) and
   * sending the user to /onboarding.
   */
  async ensure(options: { toast?: boolean } = {}): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId || this.confirmed.has(userId)) return true;
    const missing = await needsOnboarding(this.supabase.client, userId);
    // Lookup failed: let it through, the database still refuses actions without a profile.
    if (missing === null) return true;
    if (!missing) {
      this.confirmed.add(userId);
      return true;
    }
    if (options.toast !== false) this.toast.error(PROFILE_REQUIRED_MESSAGE);
    void this.router.navigate(['/onboarding']);
    return false;
  }
}
