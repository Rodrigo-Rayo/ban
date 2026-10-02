import { PostType } from '../models';

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
    case 'event_announcement': return 'Concierto';
    case 'gear_sale': return 'Vende equipo';
    default: return 'Otro';
  }
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
