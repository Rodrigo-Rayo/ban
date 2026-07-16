import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.getSession();
  if (!data.session) return router.createUrlTree(['/auth/login']);

  // Onboarding itself must always be accessible
  if (route.routeConfig?.path === 'onboarding') return true;

  const userId = data.session.user.id;
  const { data: profile } = await supabase.client
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return router.createUrlTree(['/onboarding']);

  return true;
};
