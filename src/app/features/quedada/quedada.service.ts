import { Injectable, inject, isDevMode } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { environment } from '../../../environments/environment';
import { QuedadaCycle, cycleKey, eligibleDates, openCycle } from '../../core/utils/quedada-cycle';
import { demoData, DemoState, DEMO_STATES } from './quedada-demo';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from '../../core/services/profile-gate.service';

export interface QuedadaEvent {
  id: string; user_id: string; title: string; venue: string | null; city: string;
  date: string; time: string | null; image_url?: string | null;
  /** Name of the profile that published the gig. */
  owner_name: string;
}
export interface QuedadaEntry { id: string; user_id: string; created_at: string; event: QuedadaEvent }
export interface QuedadaWinner { cycle: string; province: string; entries_count: number; event: QuedadaEvent }
export interface QuedadaPerson { user_id: string; name: string; avatar_url: string | null; profile_type: string | null; profile_id: string | null }
export interface QuedadaComment {
  id: string; user_id: string; text: string; created_at: string;
  author_name: string | null; author_avatar: string | null; author_profile_type: string | null; author_profile_id: string | null;
}

const EVENT_COLS = 'id, user_id, title, venue, city, date, time';

type Row = Record<string, unknown>;

/**
 * Data of "La quedada de BandYou" (supabase/2026_10_quedada.sql). Every read
 * degrades to "nothing" on error so the home never breaks because of it.
 *
 * Demo mode (local only, never in production): /quedada?demo=inscripcion|ganador|vacio
 * renders fake data and never touches the database.
 */
@Injectable({ providedIn: 'root' })
export class QuedadaService {
  private supabase = inject(SupabaseService);
  private gate = inject(ProfileGateService);
  private features = inject(MediaFeaturesService);
  private readonly demo: DemoState | null = readDemo();
  private demoStore = this.demo ? demoData(this.demo) : null;
  /** quedada_run_draws is asked at most once per cycle and session (pg_cron covers the rest). */
  private drawsAsked = new Set<string>();

  get demoState(): DemoState | null { return this.demo; }

  /** Current time — shifted in demo mode so every phase can be seen on any day. */
  now(): Date { return this.demoStore ? new Date(this.demoStore.now) : new Date(); }

  /** Tables exist (or demo mode). */
  async available(): Promise<boolean> {
    return this.demo ? true : this.features.has('quedada');
  }

  private async eventCols(): Promise<string> {
    return EVENT_COLS + (await this.features.has('eventImage') ? ', image_url' : '');
  }

  private async withOwnerNames(events: Row[]): Promise<QuedadaEvent[]> {
    const ids = [...new Set(events.map(e => e['user_id'] as string))];
    const names = new Map<string, string>();
    await Promise.all(ids.map(async id => {
      const { data } = await this.supabase.client.rpc('get_profile_name', { p_user_id: id });
      names.set(id, typeof data === 'string' && data ? data : 'Banda');
    }));
    return events.map(e => ({ ...(e as unknown as QuedadaEvent), owner_name: names.get(e['user_id'] as string) ?? 'Banda' }));
  }

  /** Bands signed up for a cycle in a province, oldest first. */
  async entries(cycle: QuedadaCycle, province: string): Promise<QuedadaEntry[]> {
    if (this.demoStore) return this.demoStore.entries;
    try {
      const cols = await this.eventCols();
      const { data, error } = await this.supabase.client.from('quedada_entries')
        .select(`id, user_id, created_at, events(${cols})`)
        .eq('cycle', cycleKey(cycle)).eq('province', province).order('created_at').limit(100);
      if (error || !data) return [];
      const rows = (data as unknown as Row[]).filter(r => r['events']);
      const events = await this.withOwnerNames(rows.map(r => r['events'] as Row));
      return rows.map((r, i) => ({ id: r['id'] as string, user_id: r['user_id'] as string, created_at: r['created_at'] as string, event: events[i] }));
    } catch { return []; }
  }

  /** Winner of a drawn cycle; triggers the (idempotent) draw once if it has not run yet. */
  /** Allows the draw RPC again (e.g. the countdown reached zero on this device). */
  retryDraw(cycle: QuedadaCycle) { this.drawsAsked.delete(cycleKey(cycle)); }

  async winner(cycle: QuedadaCycle, province: string): Promise<QuedadaWinner | null> {
    if (this.demoStore) return this.demoStore.winner;
    const read = async (): Promise<QuedadaWinner | null> => {
      const cols = await this.eventCols();
      const { data } = await this.supabase.client.from('quedada_winners')
        .select(`cycle, province, entries_count, events(${cols})`)
        .eq('cycle', cycleKey(cycle)).eq('province', province).maybeSingle();
      const row = data as unknown as Row | null;
      if (!row?.['events']) return null;
      const [event] = await this.withOwnerNames([row['events'] as Row]);
      return { cycle: row['cycle'] as string, province: row['province'] as string, entries_count: row['entries_count'] as number, event };
    };
    try {
      const found = await read();
      if (found) return found;
      const key = cycleKey(cycle);
      if (this.drawsAsked.has(key)) return null;
      this.drawsAsked.add(key);
      const { data: drawn } = await this.supabase.client.rpc('quedada_run_draws');
      return typeof drawn === 'number' && drawn > 0 ? await read() : null;
    } catch { return null; }
  }

  /** The user's gigs that can enter the open cycle (right province, right dates). */
  async myEligibleEvents(userId: string): Promise<QuedadaEvent[]> {
    if (this.demoStore) return this.demoStore.myEvents;
    try {
      const [from, to] = eligibleDates(openCycle(this.now()));
      const { data } = await this.supabase.client.from('events').select(await this.eventCols())
        .eq('user_id', userId).gte('date', from).lte('date', to).order('date');
      const rows = ((data ?? []) as unknown as Row[]).filter(e => e['city'] && e['city'] !== 'Otra');
      return this.withOwnerNames(rows);
    } catch { return []; }
  }

  async myEntry(userId: string, cycle: QuedadaCycle): Promise<{ id: string; event_id: string } | null> {
    if (this.demoStore) return this.demoStore.myEntry;
    try {
      const { data } = await this.supabase.client.from('quedada_entries').select('id, event_id')
        .eq('user_id', userId).eq('cycle', cycleKey(cycle)).maybeSingle();
      return (data as { id: string; event_id: string } | null) ?? null;
    } catch { return null; }
  }

  /** Signs a gig up for the open cycle. Returns an error message, or null when it worked. */
  async signUp(eventId: string): Promise<string | null> {
    if (this.demoStore) { this.demoStore.myEntry = { id: 'demo-entry', event_id: eventId }; return null; }
    if (!(await this.gate.ensure({ toast: false }))) return PROFILE_REQUIRED_MESSAGE;
    const { error } = await this.supabase.client.from('quedada_entries').insert({ event_id: eventId });
    if (!error) return null;
    if (error.code === '23505') return 'Ya tienes un bolo inscrito en este sorteo.';
    return error.hint === 'quedada' || error.hint === 'rate_limit' ? error.message : 'No se pudo inscribir el bolo. Inténtalo de nuevo.';
  }

  async withdraw(entryId: string): Promise<boolean> {
    if (this.demoStore) { this.demoStore.myEntry = null; return true; }
    const { error } = await this.supabase.client.from('quedada_entries').delete().eq('id', entryId);
    return !error;
  }

  async attendeeCount(eventId: string): Promise<number> {
    if (this.demoStore) return this.demoStore.people.length + (this.demoStore.going ? 1 : 0);
    try {
      const { data } = await this.supabase.client.rpc('quedada_attendee_count', { p_event: eventId });
      return typeof data === 'number' ? data : 0;
    } catch { return 0; }
  }

  async people(eventId: string): Promise<QuedadaPerson[]> {
    if (this.demoStore) return this.demoStore.people;
    try {
      const { data } = await this.supabase.client.rpc('quedada_people', { p_event: eventId });
      return (data as QuedadaPerson[] | null) ?? [];
    } catch { return []; }
  }

  async amGoing(eventId: string, userId: string): Promise<boolean> {
    if (this.demoStore) return this.demoStore.going;
    try {
      const { data } = await this.supabase.client.from('quedada_attendees').select('event_id')
        .eq('event_id', eventId).eq('user_id', userId).maybeSingle();
      return !!data;
    } catch { return false; }
  }

  async setGoing(eventId: string, going: boolean): Promise<boolean> {
    if (this.demoStore) { this.demoStore.going = going; return true; }
    if (going && !(await this.gate.ensure())) return true; // gate already explained it; nothing changes
    const q = this.supabase.client.from('quedada_attendees');
    const { error } = going
      ? await q.insert({ event_id: eventId })
      : await q.delete().eq('event_id', eventId).eq('user_id', (await this.supabase.auth.getSession()).data.session?.user.id ?? '');
    return !error || error.code === '23505';
  }

  async comments(eventId: string): Promise<QuedadaComment[]> {
    if (this.demoStore) return this.demoStore.comments;
    try {
      const { data } = await this.supabase.client.from('quedada_comments')
        .select('id, user_id, text, created_at, author_name, author_avatar, author_profile_type, author_profile_id')
        .eq('event_id', eventId).order('created_at').limit(300);
      return (data as QuedadaComment[] | null) ?? [];
    } catch { return []; }
  }

  async commentCount(eventId: string): Promise<number> {
    if (this.demoStore) return this.demoStore.comments.length;
    try {
      const { data } = await this.supabase.client.rpc('quedada_comment_count', { p_event: eventId });
      return typeof data === 'number' ? data : 0;
    } catch { return 0; }
  }

  /** Returns an error message, or null when it worked. */
  async addComment(eventId: string, text: string): Promise<string | null> {
    if (this.demoStore) {
      this.demoStore.comments = [...this.demoStore.comments, {
        id: 'demo-' + Date.now(), user_id: 'demo-me', text, created_at: new Date().toISOString(),
        author_name: 'Tú (demo)', author_avatar: null, author_profile_type: null, author_profile_id: null,
      }];
      return null;
    }
    if (!(await this.gate.ensure({ toast: false }))) return PROFILE_REQUIRED_MESSAGE;
    const { error } = await this.supabase.client.from('quedada_comments').insert({ event_id: eventId, text });
    if (!error) return null;
    return error.hint === 'rate_limit' || error.hint === 'quedada' ? error.message : 'No se pudo publicar el comentario.';
  }

  async deleteComment(id: string): Promise<boolean> {
    if (this.demoStore) { this.demoStore.comments = this.demoStore.comments.filter(c => c.id !== id); return true; }
    const { error } = await this.supabase.client.from('quedada_comments').delete().eq('id', id);
    return !error;
  }
}

/** ?demo=… only in dev mode (ng serve). Two independent checks: dev mode and the environment flag. */
export function readDemo(search = typeof location === 'undefined' ? '' : location.search, devMode = isDevMode()): DemoState | null {
  if (!devMode || environment.production) return null;
  if (!search) return null;
  const value = new URLSearchParams(search).get('demo') as DemoState | null;
  return value && (DEMO_STATES as readonly string[]).includes(value) ? value : null;
}
