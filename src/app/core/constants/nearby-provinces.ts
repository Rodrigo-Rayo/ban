/**
 * Spanish provinces that border each one (islands, Ceuta and Melilla: the closest by sea).
 * Used to suggest somewhere close when a province has nobody yet. Same data as api/_nearby.js.
 */
export const NEARBY_PROVINCES: Readonly<Record<string, readonly string[]>> = {
  'A Coruña': ['Pontevedra', 'Lugo'],
  'Álava': ['Vizcaya', 'Guipúzcoa', 'Navarra', 'La Rioja', 'Burgos'],
  'Albacete': ['Valencia', 'Murcia', 'Alicante', 'Cuenca', 'Ciudad Real', 'Jaén', 'Granada'],
  'Alicante': ['Valencia', 'Murcia', 'Albacete'],
  'Almería': ['Granada', 'Murcia'],
  'Asturias': ['Cantabria', 'León', 'Lugo'],
  'Ávila': ['Madrid', 'Salamanca', 'Valladolid', 'Segovia', 'Toledo', 'Cáceres'],
  'Badajoz': ['Sevilla', 'Cáceres', 'Córdoba', 'Huelva', 'Ciudad Real', 'Toledo'],
  'Barcelona': ['Girona', 'Tarragona', 'Lleida'],
  'Burgos': ['Valladolid', 'Vizcaya', 'Cantabria', 'Álava', 'La Rioja', 'Palencia', 'Soria', 'Segovia'],
  'Cáceres': ['Badajoz', 'Salamanca', 'Toledo', 'Ávila'],
  'Cádiz': ['Sevilla', 'Málaga', 'Huelva', 'Ceuta'],
  'Cantabria': ['Vizcaya', 'Asturias', 'Burgos', 'Palencia', 'León'],
  'Castellón': ['Valencia', 'Tarragona', 'Teruel'],
  'Ceuta': ['Cádiz', 'Málaga'],
  'Ciudad Real': ['Toledo', 'Córdoba', 'Jaén', 'Albacete', 'Cuenca', 'Badajoz'],
  'Córdoba': ['Sevilla', 'Málaga', 'Granada', 'Jaén', 'Ciudad Real', 'Badajoz'],
  'Cuenca': ['Madrid', 'Valencia', 'Toledo', 'Guadalajara', 'Albacete', 'Ciudad Real', 'Teruel'],
  'Girona': ['Barcelona', 'Lleida'],
  'Granada': ['Málaga', 'Jaén', 'Almería', 'Córdoba', 'Murcia', 'Albacete'],
  'Guadalajara': ['Madrid', 'Cuenca', 'Zaragoza', 'Segovia', 'Soria', 'Teruel'],
  'Guipúzcoa': ['Vizcaya', 'Navarra', 'Álava'],
  'Huelva': ['Sevilla', 'Cádiz', 'Badajoz'],
  'Huesca': ['Zaragoza', 'Lleida', 'Navarra'],
  'Islas Baleares': ['Barcelona', 'Valencia'],
  'Jaén': ['Granada', 'Córdoba', 'Ciudad Real', 'Albacete'],
  'La Rioja': ['Navarra', 'Álava', 'Burgos', 'Zaragoza', 'Soria'],
  'Las Palmas': ['Santa Cruz de Tenerife'],
  'León': ['Asturias', 'Valladolid', 'Zamora', 'Palencia', 'Cantabria', 'Lugo', 'Ourense'],
  'Lleida': ['Barcelona', 'Tarragona', 'Girona', 'Huesca', 'Zaragoza'],
  'Lugo': ['A Coruña', 'Pontevedra', 'Asturias', 'Ourense', 'León'],
  'Madrid': ['Toledo', 'Guadalajara', 'Segovia', 'Ávila', 'Cuenca'],
  'Málaga': ['Sevilla', 'Granada', 'Cádiz', 'Córdoba'],
  'Melilla': ['Málaga', 'Almería', 'Granada'],
  'Murcia': ['Alicante', 'Almería', 'Albacete', 'Granada'],
  'Navarra': ['Guipúzcoa', 'Zaragoza', 'La Rioja', 'Álava', 'Huesca'],
  'Ourense': ['Pontevedra', 'Lugo', 'León', 'Zamora'],
  'Palencia': ['Valladolid', 'Burgos', 'León', 'Cantabria'],
  'Pontevedra': ['A Coruña', 'Ourense', 'Lugo'],
  'Salamanca': ['Valladolid', 'Zamora', 'Ávila', 'Cáceres'],
  'Santa Cruz de Tenerife': ['Las Palmas'],
  'Segovia': ['Madrid', 'Valladolid', 'Ávila', 'Burgos', 'Guadalajara', 'Soria'],
  'Sevilla': ['Cádiz', 'Huelva', 'Málaga', 'Córdoba', 'Badajoz'],
  'Soria': ['Zaragoza', 'Burgos', 'La Rioja', 'Guadalajara', 'Segovia'],
  'Tarragona': ['Barcelona', 'Lleida', 'Castellón', 'Zaragoza', 'Teruel'],
  'Teruel': ['Zaragoza', 'Valencia', 'Castellón', 'Tarragona', 'Cuenca', 'Guadalajara'],
  'Toledo': ['Madrid', 'Ciudad Real', 'Cuenca', 'Ávila', 'Cáceres', 'Badajoz'],
  'Valencia': ['Alicante', 'Castellón', 'Albacete', 'Cuenca', 'Teruel'],
  'Valladolid': ['Salamanca', 'León', 'Palencia', 'Burgos', 'Segovia', 'Ávila', 'Zamora'],
  'Vizcaya': ['Guipúzcoa', 'Álava', 'Cantabria', 'Burgos'],
  'Zamora': ['Valladolid', 'León', 'Salamanca', 'Ourense'],
  'Zaragoza': ['Huesca', 'Navarra', 'Lleida', 'Tarragona', 'Teruel', 'La Rioja', 'Soria', 'Guadalajara'],
};

/** Provinces close to this one, nearest and biggest first; empty for anywhere outside Spain. */
export function nearbyProvinces(province: string): readonly string[] {
  return NEARBY_PROVINCES[province] ?? [];
}

export interface NearbyCount { city: string; n: number }

/** Rows read to count the neighbours: enough for today's numbers, still one small query. */
export const NEARBY_ROWS = 200;

/** How many rows each neighbour has, busiest first (ties keep the nearest first); empty ones left out. */
export function countNearby(rows: readonly { city?: string | null }[], near: readonly string[], max = 4): NearbyCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.city && near.includes(r.city)) counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
  return near.filter(c => counts.has(c))
    .map(city => ({ city, n: counts.get(city)! }))
    .sort((a, b) => b.n - a.n)
    .slice(0, max);
}
