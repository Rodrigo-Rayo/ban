import { SupabaseService } from '../../core/services/supabase.service';

/**
 * Photo of the profile owned by `userId` (RPC `get_profile_avatar`), or null when
 * there is none or the lookup fails. Callers fall back to a one-letter avatar.
 */
export async function fetchProfileAvatar(supabase: SupabaseService, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase.client.rpc('get_profile_avatar', { p_user_id: userId });
    return typeof data === 'string' && data ? data : null;
  } catch {
    return null;
  }
}

/** First letter for avatar fallbacks (never two). */
export function initialOf(name: string | null | undefined): string {
  return (name ?? '').trim().slice(0, 1).toUpperCase() || '?';
}
