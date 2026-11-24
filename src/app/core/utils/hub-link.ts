import { CITIES } from '../constants/cities';

/** Server-rendered pages (api/hub.js), outside the Angular router: linked with a plain href. */
export type HubKind = 'busco-banda' | 'busco-musicos' | 'musicos' | 'bandas' | 'locales-de-ensayo'
  | 'clases-de-musica' | 'salas-de-conciertos' | 'conciertos';

const isProvince = (city?: string | null): city is string => !!city && city !== 'Otra' && (CITIES as readonly string[]).includes(city);

export function citySlug(city: string): string {
  return city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The province page of a section, or the whole of Spain for "Otra", an empty or an unknown city. */
export function hubPath(kind: HubKind, city?: string | null): string {
  return isProvince(city) ? `/${kind}/${citySlug(city)}` : `/${kind}`;
}

/** Where "more like this ad" lives, by what the ad looks for. */
export function hubKindForPost(type: string): HubKind {
  if (type === 'musician_seeking_band' || type === 'collab') return 'busco-musicos';
  if (type === 'looking_for_rehearsal') return 'locales-de-ensayo';
  return 'busco-banda';
}

export interface HubLinkItem { href: string; text: string }

/** App instrument values → /busco/<slug> pages (api/_seo-kinds.js INSTRUMENTS). */
const INSTRUMENT_PAGES: Readonly<Record<string, readonly [slug: string, many: string]>> = {
  Guitarra: ['guitarrista', 'Guitarristas'], Bajo: ['bajista', 'Bajistas'], 'Batería': ['bateria', 'Baterías'],
  Voz: ['cantante', 'Cantantes'], Teclados: ['teclista', 'Teclistas'], Piano: ['pianista', 'Pianistas'],
  'Saxofón': ['saxofonista', 'Saxofonistas'], Trompeta: ['trompetista', 'Trompetistas'], 'Violín': ['violinista', 'Violinistas'],
  Flauta: ['flautista', 'Flautistas'], Clarinete: ['clarinetista', 'Clarinetistas'], Contrabajo: ['contrabajista', 'Contrabajistas'],
  Arpa: ['arpista', 'Arpistas'], 'Percusión': ['percusionista', 'Percusionistas'],
};

/** App genre values (lower case) → /estilo/<slug> pages (api/_seo-kinds.js GENRES). */
const GENRE_PAGES: Readonly<Record<string, readonly [slug: string, label: string]>> = {
  rock: ['rock', 'rock'], pop: ['pop', 'pop'], indie: ['indie', 'indie'], metal: ['metal', 'metal'], punk: ['punk', 'punk'],
  blues: ['blues', 'blues'], jazz: ['jazz', 'jazz'], funk: ['funk-soul', 'funk y soul'], soul: ['funk-soul', 'funk y soul'],
  versiones: ['versiones', 'versiones'], 'electrónica': ['electronica', 'música electrónica'], 'hip-hop': ['hip-hop', 'hip-hop y rap'],
  rap: ['hip-hop', 'hip-hop y rap'], reggae: ['reggae', 'reggae'], latino: ['latino', 'música latina'], flamenco: ['flamenco', 'flamenco'],
  folk: ['folk', 'folk'], experimental: ['experimental', 'música experimental'],
};

/** "Guitarristas en Madrid": the page of the first listed instrument that has one. Spain only. */
export function instrumentHubLink(instruments?: string | null, city?: string | null): HubLinkItem | null {
  if (!isProvince(city)) return null;
  const page = (instruments ?? '').split(',').map(i => INSTRUMENT_PAGES[i.trim()]).find(Boolean);
  return page ? { href: `/busco/${page[0]}/${citySlug(city)}`, text: `${page[1]} en ${city}` } : null;
}

/** "Bandas y músicos de rock en Madrid": the page of the first listed style that has one. Spain only. */
export function genreHubLink(genres?: string | null, city?: string | null): HubLinkItem | null {
  if (!isProvince(city)) return null;
  const page = (genres ?? '').split(/[,/]/).map(g => GENRE_PAGES[g.trim().toLowerCase()]).find(Boolean);
  return page ? { href: `/estilo/${page[0]}/${citySlug(city)}`, text: `Bandas y músicos de ${page[1]} en ${city}` } : null;
}
