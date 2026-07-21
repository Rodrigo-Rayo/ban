import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.getSession();
  if (!data.session) {
    try { sessionStorage.setItem('bandyou_return_url', state.url); } catch {}
    return router.createUrlTree(['/auth/login']);
  }

  // Onboarding itself must always be accessible
  if (route.routeConfig?.path === 'onboarding') return true;

  const userId = data.session.user.id;
  const { data: profile, error: profileError } = await supabase.client
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  // If the query itself failed (network / RLS error), allow navigation rather than
  // silently bouncing the user to onboarding — they are authenticated.
  if (profileError) {
    return true;
  }

  if (!profile?.role) return router.createUrlTree(['/onboarding']);

  return true;
};
