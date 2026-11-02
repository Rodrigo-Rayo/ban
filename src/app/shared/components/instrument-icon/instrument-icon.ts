/**
 * Instrument engravings: public-domain and CC0 photos (Wikimedia Commons, mostly The Met), cut out
 * and reduced to ink tones, in public/instruments. Ink on transparent, so they sit on the yellow
 * stamp. Keys match `INSTRUMENTS` in core/constants/music.constants.ts.
 */
export const FALLBACK_INSTRUMENT_ICON = 'Otro';

export const INSTRUMENT_ICONS: Record<string, string> = {
  'Guitarra': 'guitarra',
  'Bajo': 'bajo',
  'Batería': 'bateria',
  'Teclados': 'teclados',
  'Voz': 'voz',
  'Violín': 'violin',
  'Trompeta': 'trompeta',
  'Saxofón': 'saxofon',
  'Piano': 'piano',
  'Flauta': 'flauta',
  'Clarinete': 'clarinete',
  'Contrabajo': 'contrabajo',
  'Arpa': 'arpa',
  'Percusión': 'percusion',
  'Otro': 'otro',
};

/** Canonical key per normalised (lower-case, accent-free) stored value. */
const KEY_BY_NORMALISED: Record<string, string> = Object.fromEntries(
  Object.keys(INSTRUMENT_ICONS)
    .filter(key => key !== FALLBACK_INSTRUMENT_ICON)
    .map(key => [normalise(key), key]),
);
KEY_BY_NORMALISED['teclado'] = 'Teclados';

function normalise(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * Resolves a stored instrument value (null, "Otro", any case, no accents, or a comma list
 * like "Guitarra, Bajo, Voz") to a key of INSTRUMENT_ICONS. The first known instrument in a
 * list wins; anything unknown gets the generic note.
 */
export function instrumentIconKey(instrument: string | null | undefined): string {
  if (typeof instrument !== 'string') return FALLBACK_INSTRUMENT_ICON;
  for (const part of instrument.split(',')) {
    const key = KEY_BY_NORMALISED[normalise(part)];
    if (key) return key;
  }
  return FALLBACK_INSTRUMENT_ICON;
}

/** The engraving of a stored instrument value, as a path for an <img>. */
export function instrumentIconSrc(instrument: string | null | undefined): string {
  return `/instruments/${INSTRUMENT_ICONS[instrumentIconKey(instrument)]}.webp`;
}
