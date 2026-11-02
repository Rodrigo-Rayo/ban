import { CITIES } from '../constants/cities';

/** Server-rendered pages (api/hub.js), outside the Angular router: linked with a plain href. */
export type HubKind = 'busco-banda' | 'busco-musicos' | 'musicos' | 'bandas' | 'locales-de-ensayo'
  | 'clases-de-musica' | 'salas-de-conciertos' | 'conciertos';

export function citySlug(city: string): string {
  return city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The province page of a section, or the whole of Spain for "Otra", an empty or an unknown city. */
export function hubPath(kind: HubKind, city?: string | null): string {
  return city && city !== 'Otra' && (CITIES as readonly string[]).includes(city) ? `/${kind}/${citySlug(city)}` : `/${kind}`;
}

/** Where "more like this ad" lives, by what the ad looks for. */
export function hubKindForPost(type: string): HubKind {
  if (type === 'musician_seeking_band' || type === 'collab') return 'busco-musicos';
  if (type === 'looking_for_rehearsal') return 'locales-de-ensayo';
  return 'busco-banda';
}
