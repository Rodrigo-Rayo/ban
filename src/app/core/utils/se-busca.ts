import { PostType } from '../models';
import { dateParts, localToday } from './date';

/**
 * One meaning per stamp colour across the site:
 *  - yellow (`tag-accent`) = someone is LOOKING for something ("Busca …")
 *  - ink (`tag-night`)     = someone OFFERS something or announces it
 * Red is reserved for primary actions, never for stamps.
 */
const SEEKING: ReadonlySet<PostType> = new Set<PostType>([
  'musician_seeking_band', 'band_seeking_musician', 'looking_for_rehearsal', 'collab',
]);

export function askStampClass(type: PostType | 'vacancy'): 'tag-accent' | 'tag-night' {
  return type === 'vacancy' || SEEKING.has(type) ? 'tag-accent' : 'tag-night';
}

/** What a post or vacancy asks for, in plain words: "Busca banda", "Busca batería"… */
export function askLabel(type: PostType | 'vacancy', instrument?: string | null): string {
  const inst = (instrument ?? '').trim().toLowerCase();
  switch (type) {
    case 'vacancy':
    case 'band_seeking_musician': return inst ? `Busca ${inst}` : 'Busca músico';
    case 'musician_seeking_band': return 'Busca banda';
    case 'looking_for_rehearsal': return 'Busca local';
    case 'collab': return 'Busca colaboración';
    case 'session_offer': return 'Ofrece sesiones';
    case 'event_announcement': return 'Evento';
    case 'gear_sale': return 'Vende equipo';
    default: return 'Otro';
  }
}

/** Se busca never shows asks older than this: after three months they are rarely still valid. */
export const SE_BUSCA_MAX_DAYS = 90;

/** "Publicado" filter on the Se busca page (the last one is the default and the maximum). */
export const SE_BUSCA_PERIODS: readonly { days: number; label: string }[] = [
  { days: 7,  label: '7 días' },
  { days: 30, label: '30 días' },
  { days: SE_BUSCA_MAX_DAYS, label: '3 meses' },
];

/** ISO timestamp `days` ago, for `created_at >= …` filters. */
export function sinceISO(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

/** Labels for the post-type picker in the "Publicar en Se busca" form (no emojis). */
export const POST_TYPE_OPTIONS: readonly { id: PostType; label: string; hint: string }[] = [
  { id: 'musician_seeking_band', label: 'Busco banda',        hint: 'Eres músico y quieres tocar en un grupo' },
  { id: 'band_seeking_musician', label: 'Buscamos músico',    hint: 'Tu banda necesita a alguien' },
  { id: 'collab',                label: 'Busco colaboración', hint: 'Grabar, componer, un proyecto puntual' },
  { id: 'looking_for_rehearsal', label: 'Busco local',        hint: 'Un sitio para ensayar' },
  { id: 'session_offer',         label: 'Ofrezco sesiones',   hint: 'Tocas para grabaciones o directos' },
  { id: 'other',                 label: 'Otro',               hint: 'Cualquier otra cosa' },
];

/**
 * Text that goes with a shared Se busca link (WhatsApp groups and the like). Asks
 * read as a question to the group, which is what gets them passed on.
 */
export function shareText(p: { type: PostType; instrument?: string | null; title?: string | null; text: string; city?: string | null }): string {
  const headline = p.title?.trim() || p.text.trim().slice(0, 90);
  if (askStampClass(p.type) !== 'tag-accent') return headline;
  const where = p.city?.trim() ? ` (${p.city.trim()})` : '';
  return `¿Conoces a alguien? ${askLabel(p.type, p.instrument)}${where}: ${headline}`;
}

/** A gig date can be set this many days ahead at most (same limit as the database). */
export const GIG_MAX_DAYS_AHEAD = 60;

/** YYYY-MM-DD `days` after `from` (local dates). */
export function addDaysISO(from: string, days: number): string {
  const [y, m, d] = from.split('-').map(Number);
  return localToday(new Date(y, m - 1, d + days, 12));
}

/** "Bolo hoy", "Bolo mañana", "Bolo el sáb 14 oct"; '' without a date. */
export function gigLabel(date: string | null | undefined, today: string = localToday()): string {
  if (!date) return '';
  if (date === today) return 'Bolo hoy';
  if (date === addDaysISO(today, 1)) return 'Bolo mañana';
  const parts = dateParts(date);
  return parts ? `Bolo el ${parts.weekday} ${parts.day} ${parts.month}` : '';
}

/** A valid gig date for a new post: today up to GIG_MAX_DAYS_AHEAD days ahead. */
export function isValidGigDate(date: string, today: string = localToday()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= addDaysISO(today, GIG_MAX_DAYS_AHEAD);
}
