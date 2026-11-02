/**
 * Instrument icons: the "sharp" set of IconOven (https://iconoven.com/icons, by Appic Marketing,
 * MIT licence), 24x24 with square line ends to match the poster look. Only `currentColor`, so they
 * work in ink on yellow or in paper on ink. Keys match `INSTRUMENTS` in core/constants/music.constants.ts.
 */
export const FALLBACK_INSTRUMENT_ICON = 'Otro';

export const INSTRUMENT_ICONS: Record<string, string> = {
  'Guitarra': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5"><path d="M13.96 14.63a5.25 5.25 0 1 1-4.59-4.59a3.75 3.75 0 1 1 4.59 4.59Zm5.82-11.12l.71.71l.53.53l-.53.53l-1.41 1.41l-.53.53l-.53-.53l-.71-.71l-.53-.53l.53-.53l1.41-1.41l.53-.53zm-6.03 6.74l4.1-4.1"/><circle cx="10" cy="14" r="1.5"/><path d="m6.25 16.25l1.5 1.5"/></g>`,
  'Bajo': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="m8.96 9.76l.51-1.54l.38-1.14l.16 1.19l.25 1.86l.15 1.19l.85.85l.57.57l.85.85l1.18.21l.75.14l1.18.21l-.96.73l-1.62 1.23l-.96.73l-.63 1.02l-1 1.63l-.63 1.03H6.6l-.85-.85l-1.42-1.42l-.85-.85v-3.39l1.08-.54l.68-.34q1.07-.53 2.03-1.25l.35-.26l.96-.72zm7.68-2.96l.63.63l.43.43l.42-.43l1.27-1.27l.43-.42l-.43-.43l-.63-.63l-.43-.43l-.42.43l-1.27 1.27l-.43.42zm-5.09 5.65l5.51-5.51m-9.05 6.22l2.83 2.83M6.17 15L9 17.83"/>`,
  'Batería': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5"><circle cx="10" cy="15.25" r="6"/><circle cx="10" cy="15.25" r="2.5"/><path d="M4.25 2.75h6.5v3.5h-6.5zm14.5 3v15.5m-2.5-15.5h5"/></g>`,
  'Teclados': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2"><path stroke-width="1.5" d="M2.75 5.75h18.5v12.5H2.75zm0 5h18.5m-13.85 0v7.5m4.6-7.5v7.5m4.6-7.5v7.5"/><path stroke-width="2" d="M6.25 8.25h.01m3.24 0h.01"/><path stroke-width="1.5" d="M13.25 8.25h4.5"/></g>`,
  'Voz': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5"><path d="M8.25 2.75h7.5v11.5h-7.5z"/><path d="M4.75 10.75a7.25 7.25 0 0 0 14.5 0M12 18v3.25"/></g>`,
  'Violín': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5"><path d="M14.05 10.7c2.38 1.38 2.31 2.49 1.61 3.7c-.5.87-1.83.68-2.33 1.54c-.45.78 1.03 2.22.18 3.69c-.8 1.38-2.8 1.26-4.71.16s-3.01-2.78-2.21-4.16c.85-1.47 2.83-.91 3.28-1.69c.5-.86-.33-1.92.17-2.79c.7-1.21 1.63-1.82 4.01-.45Zm0 0l2.75-4.76"/><circle cx="17.43" cy="4.86" r="1.25"/><path d="m10.22 14.84l-1 1.73m3.16-.48l-1 1.73M3 13.5l18 7.25"/></g>`,
  'Trompeta': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="m16.8 9.89l3.65-3.53l.8-.61v12.5l-.8-.61l-3.65-3.53l-.8-.61v-3zM2.75 12H16M2.75 10.5v3m3-1.5v5.5h7.5V12m-5.5 0V7.75M10.5 12V7.75M13.25 12V7.75M7 7.75h1.5m1.25 0h1.5m1.25 0H14"/>`,
  'Saxofón': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2"><path stroke-width="1.5" d="M7.25 5.75v10a4.75 4.75 0 0 0 9.5 0V12l2.75-3.75h-7L13.75 12v5.5h-3.5V4.25h-3zm1.5-1.5v-1.5H5"/><path stroke-width="2" d="M8.75 8.5v.01m0 2.74v.01m0 2.74v.01"/></g>`,
  'Piano': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="M4.75 17.5V2.75h5.5V5.5c0 3.5 2.25 5 5.25 6.75c2.5 1.45 3.75 3.25 3.75 5.25Zm-1 0h16.5v3.75H3.75zm4 0v3.75M12 17.5v3.75m4.25-3.75v3.75"/>`,
  'Flauta': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2"><path stroke-width="1.5" d="M4.47 17.06L17.06 4.47l1.06-1.06l1.06 1.06l.35.35l1.06 1.06l-1.06 1.06L6.94 19.53l-1.06 1.06l-1.06-1.06l-.35-.35l-1.06-1.06z"/><path stroke-width="2" d="M10.94 13.06h.01m2.11-2.12h.01m2.11-2.12h.01"/><path stroke-width="1.5" d="m6.17 15.37l2.47 2.47"/></g>`,
  'Clarinete': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2"><path stroke-width="1.5" d="M10.5 6V2.75h3V6Zm.25 0H14v10.5l.38.65l1.99 3.45l.38.65h-9.5l.38-.65l1.99-3.45l.38-.65V6z"/><path stroke-width="2" d="M12 9.5h.01M12 13h.01"/></g>`,
  'Contrabajo': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="M12 6.5c3.6 0 4.25 1.4 4.25 3.25C16.25 11.2 15 11.9 15 13s3 1.9 3 4c0 1.6-2.5 2.5-6 2.5s-6-.9-6-2.5c0-2.1 3-2.9 3-4s-1.25-1.8-1.25-3.25C7.75 7.9 8.4 6.5 12 6.5Zm0 0V2.75m0 16.75v1.75m-1.75-7v2.5m3.5-2.5v2.5"/>`,
  'Arpa': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="M5.75 3.75v17h3m-3-17c2.5 0 4 3 7.5 3c2.5 0 4-1.5 5.75-1.5m-9.75.65v12.5M12.5 7.35V14m3.25-6.9v2.5M19 5.25L7.5 20.75"/>`,
  'Percusión': `<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5" d="M3.75 5h7l-.07 1l-.86 12.75l-.07 1h-6l-.07-1L2.82 6l-.07-1zm10.5 3h7l-.08 1l-.84 9.75l-.08 1h-6l-.08-1L13.33 9l-.08-1zm-4.04 5h3.47"/>`,
  'Otro': `<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-miterlimit="2" stroke-width="1.5"><path d="M11.5 17V3.75c0 1.9 1.7 3.1 3.5 3.6c1.4.4 2.75 1.4 2.75 3.15"/><circle cx="8.25" cy="17" r="3.25"/></g>`,
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
