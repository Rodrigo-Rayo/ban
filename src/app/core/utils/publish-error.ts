/**
 * The server's anti-spam triggers (supabase/audit_2026_10_launch_hardening.sql)
 * reject inserts with a readable Spanish message and hint 'rate_limit'. Show that
 * message as is; any other error gets the caller's generic copy.
 */
export function publishErrorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string; hint?: string } | null;
  return e?.hint === 'rate_limit' && e.message ? e.message : fallback;
}
