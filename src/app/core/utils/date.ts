/**
 * Today's date as YYYY-MM-DD in the user's local time zone.
 * `new Date().toISOString()` is UTC, which in Spain is still "yesterday"
 * between 00:00 and 01:00/02:00 local time.
 */
export function localToday(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Parses "YYYY-MM-DD" as a LOCAL date (new Date('2026-08-21') would be UTC midnight,
 * i.e. the previous day in the Americas) and full ISO timestamps as-is.
 */
function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const LONG_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SHORT_WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "21 ago" — adds the year only when it is not the current one ("21 ago 2025"). */
export function formatShortDate(value: string | null | undefined, now: Date = new Date()): string {
  const d = parse(value);
  if (!d) return '';
  const base = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "viernes, 21 de agosto de 2026" */
export function formatLongDate(value: string | null | undefined): string {
  const d = parse(value);
  if (!d) return '';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${LONG_MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Date block parts for poster-style dates: { weekday: 'vie', day: '21', month: 'ago' }. */
export function dateParts(value: string | null | undefined): { weekday: string; day: string; month: string } | null {
  const d = parse(value);
  if (!d) return null;
  return { weekday: SHORT_WEEKDAYS[d.getDay()], day: String(d.getDate()), month: SHORT_MONTHS[d.getMonth()] };
}

/** "21:00" from "21:00:00" / "21:00" (no trailing "h"). */
export function formatTime(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
