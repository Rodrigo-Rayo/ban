import { firstEmbed } from '../../core/utils/media-embed';
import { askLabel } from '../../core/utils/se-busca';
import { dateParts, formatTime } from '../../core/utils/date';
import { PostType } from '../../core/models';

/** Everything that can appear in the Escaparate. */
export type ShowcaseKind = 'musician' | 'band' | 'venue' | 'teacher' | 'rehearsal' | 'event' | 'post' | 'gear';

/** How the card is drawn: a photo (or an initial), a gig poster, or a Se busca stamp. */
export type ShowcaseLook = 'photo' | 'gig' | 'ask';

/** One full-screen card. */
export interface ShowcaseCard {
  /** 'm-<id>', 'ev-<id>'…: unique, and what ?p= points at. */
  key: string;
  kind: ShowcaseKind;
  look: ShowcaseLook;
  /** "Banda · Rock · Madrid", "Concierto · Sala El Perro", "Se busca · Madrid"… */
  kicker: string;
  title: string;
  subtitle: string | null;
  /** Ask text (Se busca), a few lines. */
  body: string | null;
  image: string | null;
  /** Yellow stamp: "Buscan bajista", "Busca banda", "250 €"… */
  stamp: string | null;
  /** Candidate music links, best first (profiles only). */
  links: (string | null)[];
  route: string[];
  routeLabel: string;
  /** Whoever "Escribir" opens a chat with (null: no button). */
  contactUserId: string | null;
  /** Owner of the content: the visitor never sees their own. */
  ownerId: string | null;
  city: string | null;
  /** Gig date parts, for gig cards without a poster. */
  date: { weekday: string; day: string; month: string } | null;
  created_at: string;
}

type Media = { spotify_url?: string | null; soundcloud_url?: string | null; youtube_url?: string | null; demo_url?: string | null };
const musicOf = (r: Media) => [r.demo_url ?? null, r.spotify_url ?? null, r.soundcloud_url ?? null, r.youtube_url ?? null];
const join = (...parts: (string | null | undefined)[]) => parts.map(p => (p ?? '').trim()).filter(Boolean).join(' · ');

const base = (over: Partial<ShowcaseCard> & Pick<ShowcaseCard, 'key' | 'kind' | 'title' | 'route' | 'created_at'>): ShowcaseCard => ({
  look: 'photo', kicker: '', subtitle: null, body: null, image: null, stamp: null, links: [], routeLabel: 'Ver perfil',
  contactUserId: null, ownerId: null, city: null, date: null, ...over,
});

export interface MusicianRow extends Media { id: string; user_id: string | null; name: string; instrument: string | null; genre: string | null; city: string | null; avatar_url: string | null; created_at: string; }
export interface BandRow extends Media { id: string; user_id: string | null; name: string; genre: string | null; city: string | null; avatar_url: string | null; looking_for: string | null; created_at: string; }
export interface PlaceRow { id: string; user_id: string | null; name: string; city: string | null; avatar_url: string | null; created_at: string; }
export interface TeacherRow extends PlaceRow { instrument: string | null; }
export interface EventRow { id: string; user_id: string | null; title: string; venue: string | null; city: string | null; date: string; time: string | null; genre: string | null; image_url?: string | null; created_at?: string | null; }
export interface PostRow { id: string; user_id: string | null; type: PostType; title?: string | null; text: string; city: string | null; instrument: string | null; author_name: string | null; created_at: string; }
export interface GearRow { id: string; user_id: string | null; title: string; price: number | null; city: string | null; images: string[] | null; created_at: string; }

export function musicianCard(m: MusicianRow): ShowcaseCard {
  return base({
    key: 'm-' + m.id, kind: 'musician', title: m.name, kicker: join('Músico', m.instrument, m.city), subtitle: m.genre,
    image: m.avatar_url, links: musicOf(m), route: ['/musicians', m.id], contactUserId: m.user_id, ownerId: m.user_id,
    city: m.city, created_at: m.created_at,
  });
}

export function bandCard(b: BandRow): ShowcaseCard {
  const looking = b.looking_for?.trim();
  return base({
    key: 'b-' + b.id, kind: 'band', title: b.name, kicker: join('Banda', b.genre, b.city), stamp: looking ? `Buscan ${looking}` : null,
    image: b.avatar_url, links: musicOf(b), route: ['/bands', b.id], contactUserId: b.user_id, ownerId: b.user_id,
    city: b.city, created_at: b.created_at,
  });
}

export function venueCard(v: PlaceRow): ShowcaseCard {
  return base({
    key: 'v-' + v.id, kind: 'venue', title: v.name, kicker: join('Sala de conciertos', v.city), image: v.avatar_url,
    route: ['/venues', v.id], routeLabel: 'Ver sala', contactUserId: v.user_id, ownerId: v.user_id, city: v.city, created_at: v.created_at,
  });
}

export function teacherCard(t: TeacherRow): ShowcaseCard {
  return base({
    key: 't-' + t.id, kind: 'teacher', title: t.name, kicker: join('Clases', t.instrument, t.city), image: t.avatar_url,
    route: ['/teachers', t.id], contactUserId: t.user_id, ownerId: t.user_id, city: t.city, created_at: t.created_at,
  });
}

export function rehearsalCard(r: PlaceRow): ShowcaseCard {
  return base({
    key: 'r-' + r.id, kind: 'rehearsal', title: r.name, kicker: join('Local de ensayo', r.city), image: r.avatar_url,
    route: ['/rehearsal', r.id], routeLabel: 'Ver local', contactUserId: r.user_id, ownerId: r.user_id, city: r.city, created_at: r.created_at,
  });
}

export function eventCard(e: EventRow): ShowcaseCard {
  const d = dateParts(e.date);
  const when = d ? `${d.weekday} ${d.day} ${d.month}` : null;
  return base({
    key: 'ev-' + e.id, kind: 'event', look: 'gig', title: e.title, kicker: join('Concierto', e.venue, e.city),
    subtitle: join(when, formatTime(e.time) || null, e.genre) || null, image: e.image_url ?? null, date: d,
    route: ['/events', e.id], routeLabel: 'Ver concierto', ownerId: e.user_id, city: e.city, created_at: e.created_at ?? e.date,
  });
}

export function postCard(p: PostRow): ShowcaseCard {
  const text = p.text.trim();
  return base({
    key: 'p-' + p.id, kind: 'post', look: 'ask', title: p.title?.trim() || askLabel(p.type, p.instrument),
    kicker: join('Se busca', p.city), stamp: askLabel(p.type, p.instrument),
    body: text.length > 220 ? text.slice(0, 217).trimEnd() + '…' : text, subtitle: p.author_name ? `Publica ${p.author_name}` : null,
    route: ['/posts', p.id], routeLabel: 'Ver anuncio', contactUserId: p.user_id, ownerId: p.user_id, city: p.city, created_at: p.created_at,
  });
}

export function gearCard(g: GearRow): ShowcaseCard {
  return base({
    key: 'g-' + g.id, kind: 'gear', title: g.title, kicker: join('Tienda', g.city), image: g.images?.[0] ?? null,
    stamp: g.price != null ? `${g.price} €` : null, route: ['/shop', g.id], routeLabel: 'Ver artículo',
    contactUserId: g.user_id, ownerId: g.user_id, city: g.city, created_at: g.created_at,
  });
}

export function canPlay(c: ShowcaseCard): boolean {
  return c.links.length > 0 && firstEmbed(c.links) !== null;
}

/**
 * A lively, different order on every visit: shuffled, with a gentle lean towards
 * the visitor's city and towards cards that can be heard or have a picture, and
 * never two Se busca or two shop cards in a row. Never the visitor's own content.
 */
export function showcaseOrder(cards: readonly ShowcaseCard[], city: string, me: string | null, random: () => number = Math.random): ShowcaseCard[] {
  const here = city.trim().toLowerCase();
  const score = (c: ShowcaseCard) => random()
    + (here && (c.city ?? '').toLowerCase() === here ? 0.6 : 0)
    + (canPlay(c) ? 0.4 : 0)
    + (c.image ? 0.25 : 0);
  const sorted = cards
    .filter(c => !me || c.ownerId !== me)
    .map(c => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
  return spreadOut(sorted);
}

/** Moves a card down when it would repeat the kind before it (asks and shop only: they look alike). */
function spreadOut(cards: ShowcaseCard[]): ShowcaseCard[] {
  const out: ShowcaseCard[] = [];
  const waiting: ShowcaseCard[] = [];
  const clashes = (c: ShowcaseCard) => {
    const prev = out[out.length - 1];
    return !!prev && prev.kind === c.kind && (c.kind === 'post' || c.kind === 'gear');
  };
  for (const c of cards) {
    const i = waiting.findIndex(w => !clashes(w));
    if (i >= 0) out.push(...waiting.splice(i, 1));
    if (clashes(c)) waiting.push(c); else out.push(c);
  }
  return [...out, ...waiting];
}

/** Puts the card the visitor tapped (?p=) first, keeping the rest in order. */
export function startAt(cards: readonly ShowcaseCard[], key: string | null): ShowcaseCard[] {
  const i = key ? cards.findIndex(c => c.key === key) : -1;
  return i > 0 ? [cards[i], ...cards.slice(0, i), ...cards.slice(i + 1)] : [...cards];
}
