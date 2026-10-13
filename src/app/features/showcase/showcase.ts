import { firstEmbed } from '../../core/utils/media-embed';

/** One card of the Escaparate: a musician or a band, full screen. */
export interface ShowcaseCard {
  /** 'm-<id>' / 'b-<id>': also what ?p= points at. */
  key: string;
  kind: 'musician' | 'band';
  id: string;
  user_id: string | null;
  name: string;
  /** Instrument (musician) or genre (band). */
  role: string | null;
  genre: string | null;
  city: string | null;
  avatar_url: string | null;
  /** Band vacancy text ("bajista"), shown as "Buscan …". */
  looking_for: string | null;
  /** Candidate links for the player, best first. */
  links: (string | null)[];
  created_at: string;
}

export interface ShowcaseMusicianRow {
  id: string; user_id: string | null; name: string; instrument: string | null; genre: string | null; city: string | null;
  avatar_url: string | null; spotify_url: string | null; soundcloud_url: string | null; youtube_url: string | null;
  demo_url?: string | null; created_at: string;
}

export interface ShowcaseBandRow {
  id: string; user_id: string | null; name: string; genre: string | null; city: string | null; avatar_url: string | null;
  looking_for: string | null; spotify_url: string | null; soundcloud_url: string | null; youtube_url: string | null;
  demo_url?: string | null; created_at: string;
}

export function musicianCard(m: ShowcaseMusicianRow): ShowcaseCard {
  return {
    key: 'm-' + m.id, kind: 'musician', id: m.id, user_id: m.user_id, name: m.name, role: m.instrument, genre: m.genre,
    city: m.city, avatar_url: m.avatar_url, looking_for: null,
    links: [m.demo_url ?? null, m.spotify_url, m.soundcloud_url, m.youtube_url], created_at: m.created_at,
  };
}

export function bandCard(b: ShowcaseBandRow): ShowcaseCard {
  return {
    key: 'b-' + b.id, kind: 'band', id: b.id, user_id: b.user_id, name: b.name, role: b.genre, genre: null,
    city: b.city, avatar_url: b.avatar_url, looking_for: b.looking_for?.trim() || null,
    links: [b.demo_url ?? null, b.spotify_url, b.soundcloud_url, b.youtube_url], created_at: b.created_at,
  };
}

export function canPlay(c: ShowcaseCard): boolean {
  return firstEmbed(c.links) !== null;
}

/**
 * Order of the Escaparate: the visitor's city first, then whoever can be heard,
 * then whoever has a photo, newest first. Never the visitor's own profile.
 */
export function showcaseOrder(cards: readonly ShowcaseCard[], city: string, me: string | null): ShowcaseCard[] {
  const here = city.trim().toLowerCase();
  const score = (c: ShowcaseCard) =>
    (here && (c.city ?? '').toLowerCase() === here ? 4 : 0) + (canPlay(c) ? 2 : 0) + (c.avatar_url ? 1 : 0);
  return cards
    .filter(c => !me || c.user_id !== me)
    .map(c => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || b.c.created_at.localeCompare(a.c.created_at))
    .map(x => x.c);
}

export function profileLink(c: ShowcaseCard): string[] {
  return [c.kind === 'band' ? '/bands' : '/musicians', c.id];
}
