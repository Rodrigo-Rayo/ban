import { PostType } from '../models';

/**
 * "Anuncio guiado" for Se busca: instead of a blank box, a few questions answered
 * with chips. Each group of chips becomes one natural sentence, so two people who
 * tap different chips get different ads, and the text stays editable before posting.
 */
export interface GuidedOption { id: string; label: string; phrase: string }
export interface GuidedGroup { id: string; question: string; prefix: string; joiner: 'y' | 'o'; options: readonly GuidedOption[] }

const WHEN: readonly GuidedOption[] = [
  { id: 'week',    label: 'Entre semana',    phrase: 'entre semana' },
  { id: 'weekend', label: 'Fines de semana', phrase: 'los fines de semana' },
];

const MUSICIAN: readonly GuidedGroup[] = [
  { id: 'want', question: '¿Qué buscas?', prefix: 'Busco', joiner: 'o', options: [
    { id: 'stable',  label: 'Banda estable',    phrase: 'una banda estable' },
    { id: 'project', label: 'Proyecto puntual', phrase: 'un proyecto puntual' },
    { id: 'jam',     label: 'Gente para jams',  phrase: 'gente para hacer jams' },
  ] },
  { id: 'play', question: '¿Qué quieres tocar?', prefix: 'Me interesan', joiner: 'y', options: [
    { id: 'own',    label: 'Temas propios', phrase: 'los temas propios' },
    { id: 'covers', label: 'Versiones',     phrase: 'las versiones' },
  ] },
  { id: 'when', question: '¿Cuándo puedes ensayar?', prefix: 'Puedo ensayar', joiner: 'y', options: WHEN },
  { id: 'have', question: '¿Tienes…?', prefix: 'Tengo', joiner: 'y', options: [
    { id: 'room',  label: 'Local',                 phrase: 'local de ensayo' },
    { id: 'gear',  label: 'Equipo propio',         phrase: 'equipo propio' },
    { id: 'car',   label: 'Coche',                 phrase: 'coche' },
    { id: 'stage', label: 'Experiencia en directo', phrase: 'experiencia en directo' },
  ] },
];

const BAND: readonly GuidedGroup[] = [
  { id: 'want', question: '¿Para qué lo buscáis?', prefix: 'Buscamos', joiner: 'o', options: [
    { id: 'member', label: 'Que se quede en la banda', phrase: 'a alguien que se quede en la banda' },
    { id: 'sub',    label: 'Sustituto para bolos',     phrase: 'un sustituto para algunos bolos' },
    { id: 'record', label: 'Para grabar',              phrase: 'a alguien para grabar' },
  ] },
  { id: 'play', question: '¿Qué hacéis?', prefix: 'Hacemos', joiner: 'y', options: [
    { id: 'own',    label: 'Temas propios', phrase: 'temas propios' },
    { id: 'covers', label: 'Versiones',     phrase: 'versiones' },
  ] },
  { id: 'now', question: '¿En qué punto estáis?', prefix: 'Ahora mismo', joiner: 'y', options: [
    { id: 'start',  label: 'Empezando',          phrase: 'estamos empezando' },
    { id: 'live',   label: 'Tocando en directo', phrase: 'tocamos en directo' },
    { id: 'studio', label: 'Grabando',           phrase: 'estamos grabando' },
  ] },
  { id: 'when', question: '¿Cuándo ensayáis?', prefix: 'Ensayamos', joiner: 'y', options: WHEN },
  { id: 'have', question: '¿Tenéis…?', prefix: 'Tenemos', joiner: 'y', options: [
    { id: 'room', label: 'Local',         phrase: 'local de ensayo' },
    { id: 'gigs', label: 'Bolos cerrados', phrase: 'bolos cerrados' },
  ] },
];

/** The guided questions for a post type; empty when that type keeps the free text box. */
export function guidedGroups(type: PostType): readonly GuidedGroup[] {
  if (type === 'musician_seeking_band') return MUSICIAN;
  if (type === 'band_seeking_musician') return BAND;
  return [];
}

/** "a", "a y b", "a, b y c" (or with "o"). */
export function joinList(items: readonly string[], joiner: 'y' | 'o'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`;
}

/** Selected option ids per group id. */
export type GuidedAnswers = Readonly<Record<string, readonly string[]>>;

/** The ad text: one sentence per answered group (in the groups' order), then the free line. */
export function composeGuidedText(type: PostType, answers: GuidedAnswers, extra = ''): string {
  const sentences = guidedGroups(type).flatMap(g => {
    const picked = g.options.filter(o => answers[g.id]?.includes(o.id)).map(o => o.phrase);
    return picked.length ? [`${g.prefix} ${joinList(picked, g.joiner)}.`] : [];
  });
  const more = extra.trim();
  if (more) sentences.push(/[.!?…]$/.test(more) ? more : `${more}.`);
  return sentences.join(' ');
}

/** Toggles one chip, returning new answers (nothing is mutated). */
export function toggleAnswer(answers: GuidedAnswers, groupId: string, optionId: string): GuidedAnswers {
  const current = answers[groupId] ?? [];
  const next = current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
  return { ...answers, [groupId]: next };
}

/**
 * Suggested headline from the form's own fields, within `max` characters:
 * "Batería busca banda · Rock · Madrid", "Buscamos bajo · Punk · Sevilla".
 * City and then genre are dropped when it does not fit (both also show on the card).
 */
export function suggestTitle(
  type: PostType, f: { instrument?: string | null; genre?: string | null; city?: string | null }, max = 60,
): string {
  const inst = (f.instrument ?? '').trim();
  let head: string;
  if (type === 'musician_seeking_band') head = inst ? `${inst} busca banda` : 'Músico busca banda';
  else if (type === 'band_seeking_musician') head = inst ? `Buscamos ${inst.toLowerCase()}` : 'Buscamos músico';
  else return '';
  const parts = [head, f.genre?.trim(), f.city?.trim()].filter((p): p is string => !!p);
  while (parts.length > 1 && parts.join(' · ').length > max) parts.pop();
  return parts.join(' · ').slice(0, max);
}

/** First value of a stored list ("Guitarra, Bajo") that is one of `known`; '' if none. */
export function firstKnown(stored: string | null | undefined, known: readonly string[]): string {
  return (stored ?? '').split(',').map(s => s.trim()).find(s => known.includes(s)) ?? '';
}
