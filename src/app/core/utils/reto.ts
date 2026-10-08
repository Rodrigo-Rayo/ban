/** Reto del mes (supabase/2026_10_escena.sql). */
export interface Challenge {
  id: string;
  slug: string;
  title: string;
  brief: string;
  reference_url: string | null;
  entries_until: string;
  votes_until: string;
}

export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  user_id: string;
  url: string;
  caption: string | null;
  author_name: string | null;
  author_profile_type: string | null;
  author_profile_id: string | null;
  created_at: string;
}

/** entries: you can still take part · closed: the reto is over (entries stay on show). */
export type ChallengePhase = 'entries' | 'closed';

export function challengePhase(c: Pick<Challenge, 'entries_until'>, now: Date = new Date()): ChallengePhase {
  return now.getTime() < Date.parse(c.entries_until) ? 'entries' : 'closed';
}

/** "Quedan 3 días", "Quedan 5 horas", "Quedan unos minutos"; '' once past. */
export function timeLeft(until: string, now: Date = new Date()): string {
  const ms = Date.parse(until) - now.getTime();
  if (!(ms > 0)) return '';
  const hours = Math.floor(ms / 3600000);
  if (hours >= 48) return `Quedan ${Math.floor(hours / 24)} días`;
  if (hours >= 1) return `Quedan ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return 'Quedan unos minutos';
}

const ENTRY_HOSTS = [
  'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'soundcloud.com', 'spotify.com', 'facebook.com', 'fb.watch',
];

/** Where an entry link points, for its button ("Instagram", "TikTok"…); null if not accepted. */
export function entryHost(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const known = ENTRY_HOSTS.find(h => host === h || host.endsWith('.' + h));
  if (!known) return null;
  const names: Record<string, string> = {
    'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'instagram.com': 'Instagram', 'tiktok.com': 'TikTok',
    'soundcloud.com': 'SoundCloud', 'spotify.com': 'Spotify', 'facebook.com': 'Facebook', 'fb.watch': 'Facebook',
  };
  return names[known];
}

/** A link we accept for an entry: https, on a known video/audio site, within the database limit. */
export function isValidEntryUrl(raw: string): boolean {
  return raw.trim().length <= 300 && entryHost(raw) !== null;
}
