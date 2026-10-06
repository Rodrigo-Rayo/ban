/**
 * Genres are stored as one comma-separated text ("Reggae, Blues, Rock"), so a plain
 * `ilike '%Rap%'` would also match "Trap / Urbano". This builds a case-insensitive
 * POSIX regex (PostgREST `imatch`) that only matches the genre as a whole list item.
 */
export function genrePattern(genre: string): string {
  const escaped = genre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `(^|,)\\s*${escaped}\\s*(,|$)`;
}
