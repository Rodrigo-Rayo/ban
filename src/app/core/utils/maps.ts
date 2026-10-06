/**
 * "Cómo llegar" link: a Google Maps search for the given place parts (venue, address,
 * province). Opens the Maps app on phones that have it and the website elsewhere;
 * no API key involved. Empty parts are skipped; Spain is added to narrow the search.
 */
export function mapsUrl(parts: ReadonlyArray<string | null | undefined>): string {
  const query = [...parts.map(p => p?.trim()).filter((p): p is string => !!p), 'España'].join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
