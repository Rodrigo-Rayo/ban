import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { needsOnboarding } from '../utils/profile-check';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const auth = inject(AuthService);

  const { data } = await supabase.getSession();
  if (!data.session) {
    try { sessionStorage.setItem('bandyou_return_url', state.url); } catch {}
    return router.createUrlTree(['/auth/login']);
  }

  // Onboarding itself must always be accessible
  if (route.routeConfig?.path === 'onboarding') return true;

  const userId = data.session.user.id;
  // Role already confirmed for this user in this session: skip the DB round-trip.
  if (auth.isRoleVerified(userId)) return true;

  // Every account needs a profile ("soy público" counts). If the lookup itself
  // failed (network / RLS error), allow navigation rather than silently bouncing
  // an authenticated user to onboarding.
  const missing = await needsOnboarding(supabase.client, userId);
  if (missing === null) return true;
  if (missing) return router.createUrlTree(['/onboarding']);

  auth.markRoleVerified(userId);
  return true;
};
