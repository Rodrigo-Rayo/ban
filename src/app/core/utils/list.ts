/**
 * Parses a stored multi-value field into clean items.
 * Accepts both comma-joined text ("lunes,martes") and Postgres array
 * literals ('{Lunes,"Fin de semana"}'), which exist in older rows.
 */
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map(item => item.trim().replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}
