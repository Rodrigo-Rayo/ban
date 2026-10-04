import { SupabaseService } from '../services/supabase.service';

type Client = SupabaseService['client'];

/** Table that holds the profile of each role ('listener' — "soy público" — has none). */
export const PROFILE_TABLE_BY_ROLE: Readonly<Record<string, string>> = {
  musician: 'musicians',
  band: 'bands',
  venue: 'venues',
  teacher: 'teachers',
  rehearsal: 'rehearsal_spaces',
};

/**
 * Every account must have a profile: either the 'listener' role or a row in the
 * table of a profile type. A role alone is not enough (the row may have been deleted).
 * Returns true when the user has to go through onboarding, false when the profile
 * exists, and null when the lookup failed (callers then let the user through).
 */
export async function needsOnboarding(client: Client, userId: string): Promise<boolean | null> {
  const { data: profile, error } = await client.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (error) return null;
  const role: string | undefined = profile?.role;
  if (!role) return true;
  if (role === 'listener') return false;

  const owns = async (table: string): Promise<boolean | null> => {
    const { data, error: rowError } = await client.from(table).select('id').eq('user_id', userId).maybeSingle();
    return rowError ? null : !!data;
  };

  const own = PROFILE_TABLE_BY_ROLE[role];
  const inOwnTable = own ? await owns(own) : false;
  if (inOwnTable === null) return null;
  if (inOwnTable) return false;

  // Role out of sync with the profile type: any profile row still counts.
  const others = Object.values(PROFILE_TABLE_BY_ROLE).filter(t => t !== own);
  const found = await Promise.all(others.map(owns));
  if (found.some(f => f === true)) return false;
  return found.some(f => f === null) ? null : true;
}
