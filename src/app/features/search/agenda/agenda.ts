/** The fields the "cartelera" needs from an event row. */
export interface AgendaEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string | null;
  genre: string;
  price?: string | null;
  image_url?: string | null;
  ticket_url?: string | null;
}

export interface AgendaGroup<T extends AgendaEvent = AgendaEvent> {
  key: string;
  /** "Este finde", "Noviembre", "Enero 2027"… */
  label: string;
  /** Small line under the label ("Del 31 oct al 2 nov"), may be empty. */
  hint: string;
  events: T[];
}

export type QuickFilter = 'all' | 'today' | 'weekend' | 'free';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY = 864e5;

/** "YYYY-MM-DD" as a local date at midnight. */
function day(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from `today` to the event (0 = today). */
export function daysUntil(date: string, today: string): number {
  return Math.round((day(date).getTime() - day(today).getTime()) / DAY);
}

/** The weekend (Friday to Sunday) of the week `today` is in; on Mon–Thu, the coming one. */
export function weekendOf(today: string): { from: string; to: string } {
  const t = day(today);
  const dow = t.getDay(); // 0 Sunday … 6 Saturday
  const toSunday = dow === 0 ? 0 : 7 - dow;
  const sunday = new Date(t.getTime() + toSunday * DAY);
  const friday = new Date(sunday.getTime() - 2 * DAY);
  return { from: iso(friday), to: iso(sunday) };
}

/** "Hoy", "Mañana", "En 3 días", or "" once it is more than a week away. */
export function whenLabel(date: string, today: string): string {
  const n = daysUntil(date, today);
  if (n <= 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n <= 7) return `En ${n} días`;
  return '';
}

/** "Gratis", "Libre", "0", "0 €", "Entrada libre"… */
export function isFree(price: string | null | undefined): boolean {
  if (!price) return false;
  const p = price.trim().toLowerCase();
  return /^(0+([.,]0+)?\s*€?|gratis|gratuito|gratuita|libre|entrada libre|free)$/.test(p);
}

/** "10" → "10 €"; free prices → "Gratis"; anything else as written. */
export function priceLabel(price: string | null | undefined): string {
  if (!price?.trim()) return '';
  if (isFree(price)) return 'Gratis';
  const p = price.trim();
  return /^\d+([.,]\d+)?$/.test(p) ? `${p} €` : p;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The agenda as a "cartelera": Hoy, Este finde, Esta semana, then one block per
 * month ("Noviembre", "Enero 2027"). Events stay in date order inside each
 * block; days already past are left out.
 */
export function groupAgenda<T extends AgendaEvent>(events: readonly T[], today: string): AgendaGroup<T>[] {
  const wk = weekendOf(today);
  const groups = new Map<string, AgendaGroup<T>>();
  const thisYear = day(today).getFullYear();
  const add = (key: string, label: string, hint: string, e: T) => {
    const g = groups.get(key) ?? { key, label, hint, events: [] };
    g.events.push(e);
    groups.set(key, g);
  };
  const short = (d: string) => `${day(d).getDate()} ${SHORT_MONTHS[day(d).getMonth()]}`;
  const sorted = [...events]
    .filter(e => e.date && e.date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  for (const e of sorted) {
    const d = e.date.slice(0, 10);
    if (d === today) { add('today', 'Hoy', '', e); continue; }
    if (d >= wk.from && d <= wk.to) { add('weekend', 'Este finde', `Del ${short(wk.from)} al ${short(wk.to)}`, e); continue; }
    if (d < wk.from) { add('week', 'Esta semana', '', e); continue; }
    const m = day(d);
    const key = `m-${m.getFullYear()}-${m.getMonth()}`;
    const label = capital(MONTHS[m.getMonth()]) + (m.getFullYear() === thisYear ? '' : ` ${m.getFullYear()}`);
    add(key, label, '', e);
  }
  return [...groups.values()];
}

/** The quick filter pills ("Hoy", "Este finde", "Gratis") applied to the loaded events. */
export function applyQuickFilter<T extends AgendaEvent>(events: readonly T[], filter: QuickFilter, today: string): T[] {
  if (filter === 'today') return events.filter(e => e.date.slice(0, 10) === today);
  if (filter === 'weekend') {
    const wk = weekendOf(today);
    return events.filter(e => { const d = e.date.slice(0, 10); return d >= wk.from && d <= wk.to; });
  }
  if (filter === 'free') return events.filter(e => isFree(e.price));
  return [...events];
}

/** A colour for posterless events, stable per event. */
export const POSTER_TONES = ['red', 'ink', 'yellow', 'green'] as const;
export type PosterTone = (typeof POSTER_TONES)[number];

export function posterTone(id: string): PosterTone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return POSTER_TONES[h % POSTER_TONES.length];
}

/** Small, stable tilt per poster (degrees), so the wall does not look machine-made. */
export function posterTilt(index: number): number {
  return [-1.4, 0.9, -0.6, 1.3, -1, 0.5][index % 6];
}
