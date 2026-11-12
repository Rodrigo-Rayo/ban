import { CITIES } from '../constants/cities';
import { COUNTRIES, Country } from '../constants/regions';

/**
 * Where someone is, stored as plain text in every `city` column:
 * a Spanish province as it always was ("Madrid"), a region elsewhere as "Pichincha, Ecuador",
 * or "Otra" for any other country. No province name contains a comma, so the two never clash.
 */
export const SPAIN = 'ES';
export const OTHER_COUNTRY = 'XX';
export const OTHER_VALUE = 'Otra';
/** Filter value meaning "no filter" (the label predates other countries; it stays for saved links). */
export const ALL_PLACES = 'Toda España';

const PROVINCES = CITIES.filter(c => c !== OTHER_VALUE) as readonly string[];
const BY_CODE = new Map(COUNTRIES.map(c => [c.code, c]));
const BY_NAME = new Map(COUNTRIES.map(c => [c.name, c]));

export interface Place { country: string; region: string }

export function countryByCode(code: string): Country | undefined { return BY_CODE.get(code); }

export function placeValue(country: string, region: string): string {
  if (country === OTHER_COUNTRY) return OTHER_VALUE;
  if (!region) return '';
  if (country === SPAIN) return region;
  const c = BY_CODE.get(country);
  return c ? `${region}, ${c.name}` : '';
}

/** Reads a stored value back. Unknown text (old data) counts as Spain with no province picked. */
export function parsePlace(value: string | null | undefined): Place {
  const v = (value ?? '').trim();
  if (v === OTHER_VALUE) return { country: OTHER_COUNTRY, region: '' };
  if (PROVINCES.includes(v)) return { country: SPAIN, region: v };
  const cut = v.lastIndexOf(', ');
  if (cut > 0) {
    const c = BY_NAME.get(v.slice(cut + 2));
    const region = v.slice(0, cut);
    if (c && c.regions.includes(region)) return { country: c.code, region };
  }
  return { country: SPAIN, region: '' };
}

/** A Spanish province or a region of a listed country ("Otra" and free text are not). */
export function isKnownPlace(value: string | null | undefined): boolean {
  return !!parsePlace(value).region;
}

export function isSpanishProvince(value: string | null | undefined): boolean {
  return PROVINCES.includes((value ?? '').trim());
}

export interface PlaceOption { value: string; label: string }
export interface PlaceGroup { label: string; options: readonly PlaceOption[] }

/** Options for the filters: all, Spain's provinces, then each country (whole country first). */
export const PLACE_FILTER_GROUPS: readonly PlaceGroup[] = [
  { label: 'España', options: [{ value: ALL_PLACES, label: ALL_PLACES }, ...PROVINCES.map(p => ({ value: p, label: p }))] },
  ...COUNTRIES.map(c => ({
    label: c.name,
    options: [{ value: `pais:${c.code}`, label: `Todo ${c.name}` }, ...c.regions.map(r => ({ value: `${r}, ${c.name}`, label: r }))],
  })),
  { label: 'Resto del mundo', options: [{ value: OTHER_VALUE, label: 'Otro país' }] },
];

/** A filter value as people read it: "pais:AR" is "Argentina", "Otra" is "otro país"; anything else is already a name. */
export function placeLabel(value: string): string {
  if (value === OTHER_VALUE) return 'otro país';
  return value.startsWith('pais:') ? BY_CODE.get(value.slice(5))?.name ?? value : value;
}

/** A filter option with the group it belongs to ("España", "Argentina"…). */
export interface PlaceMatch extends PlaceOption { group: string }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PLACE_INDEX = PLACE_FILTER_GROUPS.flatMap(g =>
  g.options.map(o => ({ value: o.value, label: o.label, group: g.label, key: fold(o.label), groupKey: fold(g.label), full: fold(`${o.label}, ${g.label}`) })));

/** The option for a filter value, if it is one. */
export function placeOption(value: string): PlaceMatch | undefined {
  const o = PLACE_INDEX.find(p => p.value === value);
  return o && { value: o.value, label: o.label, group: o.group };
}

/**
 * Splits a name around the first stretch matching what was typed, ignoring accents and case:
 * ("Córdoba", "cor") → ["", "Cór", "doba"]. No match → [name, "", ""].
 */
export function matchParts(label: string, query: string): [string, string, string] {
  const q = fold(query.trim());
  // One folded character per original one, as long as names come precomposed (NFC).
  const at = q && label.length === fold(label).length ? fold(label).indexOf(q) : -1;
  return at < 0 ? [label, '', ''] : [label.slice(0, at), label.slice(at, at + q.length), label.slice(at + q.length)];
}

/** The option whose name is exactly what someone typed ("malaga", "córdoba, argentina"); Spain wins ties. */
export function exactPlace(text: string): PlaceMatch | undefined {
  const q = fold(text.trim());
  const o = q ? PLACE_INDEX.find(p => p.key === q || p.full === q) : undefined;
  return o && { value: o.value, label: o.label, group: o.group };
}

/**
 * Filter options matching what someone typed, ignoring accents and case: names that start with it
 * first, then names that contain it, then every place of a country whose name matches.
 */
export function searchPlaces(query: string, limit = 40): PlaceMatch[] {
  const q = fold(query.trim());
  if (!q) return [];
  const starts = PLACE_INDEX.filter(p => p.key.startsWith(q) || p.key.split(/[\s-]+/).some(w => w.startsWith(q)));
  const contains = PLACE_INDEX.filter(p => !starts.includes(p) && (p.key.includes(q) || p.full.includes(q)));
  const inCountry = PLACE_INDEX.filter(p => !starts.includes(p) && !contains.includes(p) && p.groupKey.startsWith(q));
  return [...starts, ...contains, ...inCountry].slice(0, limit).map(({ value, label, group }) => ({ value, label, group }));
}

interface CityQuery<Q> { eq(column: string, value: string): Q; like(column: string, pattern: string): Q }

/** Narrows a Supabase query to a filter value: nothing, a whole country or one place. */
export function whereCity<Q extends CityQuery<Q>>(q: Q, value: string): Q {
  if (!value || value === ALL_PLACES) return q;
  if (value.startsWith('pais:')) {
    const c = BY_CODE.get(value.slice(5));
    return c ? q.like('city', `%, ${c.name}`) : q;
  }
  return q.eq('city', value);
}
