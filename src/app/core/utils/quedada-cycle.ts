/**
 * Dates of "La quedada de BandYou" — mirrors supabase/2026_10_quedada.sql.
 * A cycle is a month. Entries close and the draw happens on day 10 at 20:00
 * (Madrid time); valid gigs are dated from day 10 to the last day of that month.
 */
export interface QuedadaCycle { year: number; month: number } // month 1–12

export const DRAW_DAY = 10;
export const DRAW_HOUR = 20;
const ZONE = 'Europe/Madrid';

/** Wall-clock time in Madrid → real instant (handles summer/winter time). */
export function madridInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Offset of Madrid at that moment, found by formatting the UTC guess in Madrid.
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - t;
  };
  const first = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(first));
}

/** Month (in Madrid) that contains `now`. */
export function madridMonth(now: Date): QuedadaCycle {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit' }).formatToParts(now);
  return { year: Number(parts.find(p => p.type === 'year')?.value), month: Number(parts.find(p => p.type === 'month')?.value) };
}

export function nextCycle(c: QuedadaCycle): QuedadaCycle {
  return c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 };
}

export function previousCycle(c: QuedadaCycle): QuedadaCycle {
  return c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 };
}

export function drawAt(c: QuedadaCycle): Date {
  return madridInstant(c.year, c.month, DRAW_DAY, DRAW_HOUR);
}

/** Cycle anyone signing up right now joins: this month until its draw, next month after. */
export function openCycle(now: Date): QuedadaCycle {
  const month = madridMonth(now);
  return now < drawAt(month) ? month : nextCycle(month);
}

/** Cycle whose winner may be on show: this month once drawn, otherwise none. */
export function drawnCycle(now: Date): QuedadaCycle | null {
  const month = madridMonth(now);
  return now >= drawAt(month) ? month : null;
}

/** 'YYYY-MM-01', as stored in quedada_entries.cycle / quedada_winners.cycle. */
export function cycleKey(c: QuedadaCycle): string {
  return `${c.year}-${String(c.month).padStart(2, '0')}-01`;
}

/** Valid gig dates for a cycle, inclusive: ['YYYY-MM-10', 'YYYY-MM-<last>']. */
export function eligibleDates(c: QuedadaCycle): [string, string] {
  const last = new Date(Date.UTC(c.year, c.month, 0)).getUTCDate();
  const mm = String(c.month).padStart(2, '0');
  return [`${c.year}-${mm}-${String(DRAW_DAY).padStart(2, '0')}`, `${c.year}-${mm}-${last}`];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function monthName(c: QuedadaCycle): string {
  return MONTHS[c.month - 1];
}

/** When a gig starts (date + optional 'HH:MM', Madrid time); 21:00 when the time is unknown. */
export function gigInstant(date: string, time?: string | null): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}/.test(time) ? time : '21:00').split(':').map(Number);
  return madridInstant(y, m, d, hh, mm);
}
