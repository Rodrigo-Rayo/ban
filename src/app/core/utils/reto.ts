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
  votes: number;
  created_at: string;
}

/** entries: you can still take part (and vote) · voting: only votes · closed: there is a winner. */
export type ChallengePhase = 'entries' | 'voting' | 'closed';

export function challengePhase(c: Pick<Challenge, 'entries_until' | 'votes_until'>, now: Date = new Date()): ChallengePhase {
  const t = now.getTime();
  if (t < Date.parse(c.entries_until)) return 'entries';
  if (t < Date.parse(c.votes_until)) return 'voting';
  return 'closed';
}

/** Most votes first; on a tie, whoever entered first. */
export function rankEntries(entries: readonly ChallengeEntry[]): ChallengeEntry[] {
  return [...entries].sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
}

/** The winner once voting has closed (needs at least one vote). */
export function challengeWinner(entries: readonly ChallengeEntry[]): ChallengeEntry | null {
  const top = rankEntries(entries)[0];
  return top && top.votes > 0 ? top : null;
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
