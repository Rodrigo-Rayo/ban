import { EmailOtpType } from '@supabase/supabase-js';

/** Email links we build ourselves in the Supabase templates (link on bandyou.es). */
const TYPES: ReadonlySet<EmailOtpType> = new Set<EmailOtpType>(['recovery', 'signup', 'email', 'magiclink', 'email_change', 'invite']);

/**
 * `?token_hash=…&type=recovery` from an auth email whose button points at
 * www.bandyou.es/auth/callback (not at the Supabase domain, which spam filters
 * distrust). Null for anything else, so the older link formats keep working.
 */
export function readEmailLink(search: string): { tokenHash: string; type: EmailOtpType } | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash')?.trim();
  const type = params.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.has(type) || !/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash)) return null;
  return { tokenHash, type };
}
