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

/** A filter value as people read it: "pais:AR" is "Argentina"; anything else is already a name. */
export function placeLabel(value: string): string {
  return value.startsWith('pais:') ? BY_CODE.get(value.slice(5))?.name ?? value : value;
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
