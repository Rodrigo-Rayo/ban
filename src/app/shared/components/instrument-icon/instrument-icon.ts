/**
 * "Cartel" instrument stamps: solid, chunky silhouettes with cut-out details, drawn
 * for a 48x48 viewBox. Only `currentColor` fills, so they work in ink on yellow or in
 * paper on ink. Keys match `INSTRUMENTS` in core/constants/music.constants.ts.
 */
export const FALLBACK_INSTRUMENT_ICON = 'Otro';

export const INSTRUMENT_ICONS: Record<string, string> = {
  Guitarra: `<g transform="translate(24 24) rotate(40) scale(1) translate(-24 -24)"><path d="M20-3h8l1 12H19zM16.5-1.5h3.7v2.5h-3.7zM16.5 2.5h3v2.5h-3zM16.5 6.5h2.8V9h-2.8zM27.8-1.5h3.7v2.5h-3.7zM28 2.5h3V5h-3zM28.2 6.5H31V9h-2.8zM22 9h4v14h-4z"/><path fill-rule="evenodd" d="M15 18l6 7h6l6-7 4 9-3 6 5 7-3 8-12 3-12-3-3-8 5-7-3-6zM17 33h14v3H17zM17 39h14v3H17zM20 45h8v2h-8z"/></g>`,
  Bajo: `<g transform="translate(24 24) rotate(-30) scale(1) translate(-24 -24)"><path d="M20.5-3h7l.5 13h-8zM15.5-1h5v3.5h-5zM15.5 5h5v3.5h-5zM27.5-1h5v3.5h-5zM27.5 5h5v3.5h-5zM22.5 10h3v22h-3z"/><path fill-rule="evenodd" d="M14 22l7 8h6l5-2 4 4-3 5 4 6-3 6-10 2-10-2-3-6 4-6-3-8zM17 35h14v5H17zM19 44.5h10v2H19z"/></g>`,
  Batería: `<path d="M1 10l11-4 1 2.5L2 12.5zM47 10L36 6l-1 2.5 11 4zM5.5 11h2v33h-2zM40.5 11h2v33h-2zM3 45h7v2H3zM38 45h7v2h-7z"/><path fill-rule="evenodd" d="M13 12h10v8H13zM14.5 14h7v1.5h-7zM25 12h10v8H25zM26.5 14h7v1.5h-7zM16 22h16l5 5v13l-5 5H16l-5-5V27zM17 26.5h14l2 2v10l-2 2H17l-2-2v-10zM21.5 31h5l1.5 1.5v2L26.5 36h-5L20 34.5v-2z"/>`,
  Teclados: `<path fill-rule="evenodd" d="M3 7h42v19H3zM7 9.5h3v2.5H7zM12 9.5h3v2.5h-3zM17 9.5h3v2.5h-3zM30 10h12v1.5H30zM5 15h4v8H5zm5.6 0h4v8h-4zm5.6 0h4v8h-4zm5.6 0h4v8h-4zm5.6 0h4v8h-4zm5.6 0h4v8h-4zm5.6 0h4v8h-4z"/><path d="M8.5 27h5l27 19h-5zM39.5 27h-5L7.5 46h5zM21 34h6v4h-6z"/>`,
  Voz: `<path fill-rule="evenodd" d="M16 3h16l3 4v14l-3 4H16l-3-4V7zM17 7h14v1.8H17zM17 11h14v1.8H17zM17 15h14v1.8H17zM17 19h14v1.8H17z"/><path d="M8 14h3v11l13 5.5L37 25V14h3v13L24 35 8 27zM11 13h2v3h-2zM35 13h2v3h-2zM22.5 33h3v8h-3zM11 46l5-5h16l5 5z"/>`,
  Violín: `<g transform="translate(-6 1) rotate(-14 24 26)"><path fill-rule="evenodd" d="M19 20h10l3 4-1 4-3 3 4 5 1 5-4 4H19l-4-4 1-5 4-5-3-3-1-4zM20.4 29H22l-.9 8.5H19.5zM27.6 29H26l.9 8.5h1.6z"/><path d="M22.3 9h3.4v11h-3.4zM21.5 9V4.5L24 2l2.5 2.5V9zM19 4h2.5v1.8H19zM26.5 6.5H29v1.8h-2.5z"/></g><path d="M41 3h2.2l-5 40h-2.2zM34.5 39h5.5v5h-5.5z"/>`,
  Trompeta: `<path d="M2 20l4 1.5v3L2 26zM6 21h10v3H6z"/><path fill-rule="evenodd" d="M9 22h23v12H9zM12 25h17v6H12z"/><path fill-rule="evenodd" d="M31 26l11-11h4v26h-4L31 31zM35 28l4.5-5.5v12z"/><path d="M13.5 11h4.5v2.5h-4.5zM19 11h4.5v2.5H19zM24.5 11H29v2.5h-4.5zM14.8 13h2v9h-2zM20.3 13h2v9h-2zM25.8 13h2v9h-2z"/>`,
  Saxofón: `<path d="M3 10l6-5 10 1 7 4 2 5h-7l-4-4H9zM18.5 21h3v2.5h-3zM18.5 28h3v2.5h-3z"/><path fill-rule="evenodd" d="M21 13h8l5 24-9 1zM24.8 17.5h2.4v2.4h-2.4zM25.8 24h2.4v2.4h-2.4zM27 30h2.4v2.4H27z"/><path fill-rule="evenodd" d="M25 38l9-1 2-7 4-6 7 7-3 10-7 5H27l-5-5zM41 28l3 3-2 4-3-3z"/>`,
  Piano: `<path fill-rule="evenodd" d="M8 5l32 7-2 9H8zM3 23h34l8 5-7 5H3zM5 25h1.6v4.5H5zM8 25h1.6v4.5H8zM11 25h1.6v4.5H11zM14 25h1.6v4.5H14zM17 25h1.6v4.5H17z"/><path d="M4.5 34h4.5l-.6 12H5.4zM21 34h4.5l-.6 12h-3zM35.5 34H40l-.6 12h-3z"/>`,
  Flauta: `<g transform="translate(24 24) rotate(-35) scale(1.08) translate(-24 -24)"><path fill-rule="evenodd" d="M0 22.5L3 21h43l2 2v2l-2 2H3l-3-1.5zM6 24a2.2 1.5 0 1 0 4.4 0A2.2 1.5 0 1 0 6 24zM17.5 22.9h2.2v2.2h-2.2zM22.3 22.9h2.2v2.2h-2.2zM27.1 22.9h2.2v2.2h-2.2zM31.9 22.9h2.2v2.2h-2.2zM36.7 22.9h2.2v2.2h-2.2zM41.5 22.9h2.2v2.2h-2.2z"/><path d="M22 18.5h3.5V21H22zM31.5 18.5H35V21h-3.5z"/></g>`,
  Clarinete: `<path d="M20.5 1.5h7l1.5 7.5H19zM19 9h10v3.5H19z"/><path fill-rule="evenodd" d="M20 12.5h8V37l5 10H15l5-10zM22.2 15.5h3.6v2.7h-3.6zM22.2 21h3.6v2.7h-3.6zM22.2 26.5h3.6v2.7h-3.6zM22.2 32h3.6v2.7h-3.6zM19.5 42h9l1 2h-11z"/><path d="M28 19h4v2.6h-4zM16 26h4v2.6h-4zM28 30h4v2.6h-4z"/>`,
  Contrabajo: `<path fill-rule="evenodd" d="M21 12h6l8 7-1 5-4 4 6 5 2 5-5 5H15l-5-5 2-5 6-5-4-4-1-5zM19 26h1.8l-.9 11h-1.8zM29 26h-1.8l.9 11h1.8zM22 35h4l-.5 5h-3z"/><path d="M22.2 4h3.6v8h-3.6zM21 4V2.5L24 .5l3 2V4zM23.2 43h1.6v5h-1.6z"/>`,
  Percusión: `<path fill-rule="evenodd" d="M4.5 11h19l-.5 9-2 12-1.5 13h-11L7 32 5 20zM7 14.5a7 2 0 1 0 14 0 7 2 0 1 0-14 0zM8 25h12v1.6H8zM9.5 35h10v1.6h-10zM26 17h16l-.5 7-2 10-1 11h-9l-1-11-2-10zM28 20a6 1.8 0 1 0 12 0 6 1.8 0 1 0-12 0zM29 28h10v1.6H29zM30.5 37h7v1.6h-7z"/>`,
  Arpa: `<path fill-rule="evenodd" d="M5 3l23 6 16 12-8 7-20 18H5zM10 11l17 4 10 7-21 19h-6z"/><path d="M14 11h1.8v31H14zM19 12h1.8v26.5H19zM24 13h1.8v21H24zM29 16h1.8v13.5H29z"/>`,
  Otro: `<path fill-rule="evenodd" d="M7 37l4-6 10-2 6 4-4 7-10 2zM12 36l6-1.5v1.5l-6 1.5z"/><path d="M23 8h5v27h-5zM28 8l14 10-2 10-7-6-5-1z"/>`,
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
