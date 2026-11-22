import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { SITE_URL, SeoService } from '../../core/services/seo.service';
import { MessagesService } from '../../core/services/messages.service';
import { ToastService } from '../../core/services/toast.service';
import { GENRES, INSTRUMENTS } from '../../core/constants/music.constants';
import { nearbyProvinces } from '../../core/constants/nearby-provinces';
import { ALL_PLACES, ANY_PLACE, SPAIN, countryByCode, defaultPlace, isKnownPlace, isSpanishProvince, parsePlace, placeLabel, whereCity } from '../../core/utils/place';
import { avatarColor, imageSrc } from '../../core/utils/display.utils';
import { parseList } from '../../core/utils/list';
import { PlaceFilterComponent } from '../../shared/components/place-filter/place-filter.component';

export interface BuilderMusician { id: string; name: string; city: string; avatar_url: string | null; instrument: string; genre: string; user_id: string; created_at: string; }
export interface BandSlot { instrument: string; musicians: BuilderMusician[]; nearLabel: string; }

const COLS = 'id,name,city,avatar_url,instrument,genre,user_id,created_at';
export const MAX_MISSING = 5;
const PER_SLOT = 3;
/** Per instrument: enough to show 3 after dropping Contrabajo-for-Bajo, your own profile and seed rows. */
const ROWS = 12;
const DEBOUNCE_MS = 300;
const PICKABLE = INSTRUMENTS.filter(i => i !== 'Otro');
const QUICK_PICK = ['Batería', 'Bajo'];

const fold = (s: string) => s.trim().toLowerCase();
const plays = (m: BuilderMusician, inst: string) => parseList(m.instrument).some(i => fold(i) === fold(inst));

/** The viewer's own province or region if it is one we know, else the usual default. */
function startPlace(): string {
  let city = '';
  try { city = localStorage.getItem('bandyou_city') ?? ''; } catch { /* storage blocked */ }
  return isKnownPlace(city) ? city : defaultPlace();
}

/** A place filter value we understand; anything else from the URL is ignored. */
export function isPlaceValue(v: string): boolean {
  return v === ALL_PLACES || v === ANY_PLACE || (v.startsWith('pais:') && !!countryByCode(v.slice(5))) || isKnownPlace(v);
}

type ByInstrument = Readonly<Record<string, BuilderMusician[]>>;

/** Who fills one slot: chosen style first, then those with a photo, then newest (rows come newest first). */
export function fillSlot(rows: readonly BuilderMusician[], instrument: string, genre: string): BuilderMusician[] {
  const score = (m: BuilderMusician) =>
    (genre && parseList(m.genre).some(g => fold(g) === fold(genre)) ? 2 : 0) + (m.avatar_url ? 1 : 0);
  return rows.filter(m => plays(m, instrument))
    .map((m, i) => ({ m, i, s: score(m) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, PER_SLOT)
    .map(x => x.m);
}

@Component({
  selector: 'app-band-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PlaceFilterComponent],
  templateUrl: './band-builder.component.html',
})
export class BandBuilderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private messages = inject(MessagesService);
  private toast = inject(ToastService);

  readonly imageSrc = imageSrc;
  readonly avatarColor = avatarColor;
  readonly placeLabel = placeLabel;
  readonly instruments = PICKABLE;
  readonly genres = GENRES;
  readonly quickPick = QUICK_PICK;
  readonly maxMissing = MAX_MISSING;

  readonly place = signal(startPlace());
  readonly missing = signal<string[]>([]);
  readonly genre = signal('');
  readonly loading = signal(false);
  readonly error = signal(false);
  /** Rows for the chosen place, and the widened rows (neighbours / whole country) for empty slots. */
  private readonly rows = signal<ByInstrument>({});
  private readonly wideRows = signal<ByInstrument>({});
  private readonly wideLabel = signal('');
  readonly opening = signal<string | null>(null);

  private viewerId: string | null = null;
  private session: Promise<void> | null = null;
  private sub?: Subscription;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;
  private loadedKey: string | null = null;

  readonly slots = computed<BandSlot[]>(() => this.missing().map(instrument => {
    const here = fillSlot(this.rows()[instrument] ?? [], instrument, this.genre());
    if (here.length) return { instrument, musicians: here, nearLabel: '' };
    return { instrument, musicians: fillSlot(this.wideRows()[instrument] ?? [], instrument, this.genre()), nearLabel: this.wideLabel() };
  }));

  /** " en Madrid" for a real place; nothing for all of Spain or every country. */
  readonly scope = computed(() => [ALL_PLACES, ANY_PLACE].includes(this.place()) ? '' : ' en ' + placeLabel(this.place()));

  ngOnInit() {
    this.seo.set({
      title: 'Arma tu banda: encuentra a quien os falta',
      description: 'Elige dónde estás y qué instrumentos os faltan: te enseñamos músicos cerca que tocan justo eso, listos para escribirles. Gratis en BandYou.',
      url: `${SITE_URL}/arma-tu-banda`,
    });
    this.session = this.supabase.getSession()
      .then(({ data }) => { this.viewerId = data.session?.user?.id ?? null; })
      .catch(() => { this.viewerId = null; });
    this.sub = this.route.queryParams.subscribe(p => this.readParams(p));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.timer);
  }

  private readParams(p: Params) {
    const raw = typeof p['donde'] === 'string' ? p['donde'].trim() : '';
    const donde = isPlaceValue(raw) ? raw : startPlace();
    const faltan = [...new Set(parseList(typeof p['faltan'] === 'string' ? p['faltan'] : '')
      .map(x => PICKABLE.find(i => fold(i) === fold(x)))
      .filter((x): x is string => !!x))].slice(0, MAX_MISSING);
    const estilo = typeof p['estilo'] === 'string' ? GENRES.find(g => fold(g) === fold(p['estilo'])) ?? '' : '';
    this.place.set(donde);
    this.missing.set(faltan);
    this.genre.set(estilo);
    this.scheduleLoad();
  }

  /** Style only reorders what is loaded; place and instruments ask again (first time right away, later debounced). */
  private scheduleLoad() {
    const key = `${this.place()}|${this.missing().join(',')}`;
    if (key === this.loadedKey) return;
    const first = this.loadedKey === null;
    this.loadedKey = key;
    clearTimeout(this.timer);
    if (first) { void this.load(); return; }
    this.seq++; // an answer still in flight is for the old choice
    this.loading.set(true);
    this.timer = setTimeout(() => void this.load(), DEBOUNCE_MS);
  }

  private writeUrl() {
    const queryParams: Record<string, string> = {};
    if (this.place() !== startPlace()) queryParams['donde'] = this.place();
    if (this.missing().length) queryParams['faltan'] = this.missing().join(',');
    if (this.genre()) queryParams['estilo'] = this.genre();
    this.router.navigate([], { queryParams, replaceUrl: true });
  }

  setPlace(value: string) { this.place.set(value || startPlace()); this.writeUrl(); }
  setGenre(value: string) { this.genre.set(value); this.writeUrl(); }

  toggle(instrument: string) {
    const list = this.missing();
    if (list.includes(instrument)) this.missing.set(list.filter(i => i !== instrument));
    else if (list.length < MAX_MISSING) this.missing.set([...list, instrument]);
    else return;
    this.writeUrl();
  }

  retry() { this.loadedKey = null; this.scheduleLoad(); }

  pickQuick() { this.missing.set([...QUICK_PICK]); this.writeUrl(); }

  async load() {
    const seq = ++this.seq;
    const missing = this.missing();
    const place = this.place();
    if (!missing.length) {
      this.rows.set({}); this.wideRows.set({}); this.loading.set(false); this.error.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    try {
      await this.session;
      const rows = await this.fetchEach(missing, q => whereCity(q, place));
      if (seq !== this.seq) return;
      const empty = missing.filter(i => !rows[i].length);
      let wide: ByInstrument = {};
      let label = '';
      const widen = empty.length ? this.widerArea(place) : null;
      if (widen) {
        wide = await this.fetchEach(empty, widen.narrow).catch(() => ({}));
        if (seq !== this.seq) return;
        label = widen.label;
      }
      this.rows.set(rows);
      this.wideRows.set(wide);
      this.wideLabel.set(label);
    } catch {
      if (seq !== this.seq) return;
      this.rows.set({}); this.wideRows.set({}); this.error.set(true);
      this.loadedKey = null; // the next change (or "Reintentar") asks again
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private widerArea(place: string): { label: string; narrow: (q: any) => any } | null {
    if (isSpanishProvince(place)) {
      const near = nearbyProvinces(place);
      return near.length ? { label: `Cerca de ${place}`, narrow: q => q.in('city', near) } : null;
    }
    const { country, region } = parsePlace(place);
    const c = region && country !== SPAIN ? countryByCode(country) : undefined;
    return c ? { label: `En todo ${c.name}`, narrow: q => whereCity(q, `pais:${c.code}`) } : null;
  }

  /** One small query per instrument, in parallel, so a common one can't crowd out a rare one. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchEach(instruments: readonly string[], narrow: (q: any) => any): Promise<Record<string, BuilderMusician[]>> {
    const lists = await Promise.all(instruments.map(async inst => {
      const q = narrow(this.supabase.client.from('musicians').select(COLS)).ilike('instrument', `%${inst}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(ROWS);
      if (error) throw error;
      return ((data ?? []) as BuilderMusician[]).filter(m => m.user_id && m.user_id !== this.viewerId && plays(m, inst));
    }));
    return Object.fromEntries(instruments.map((inst, i) => [inst, lists[i]]));
  }

  searchParams(instrument: string) {
    return { tab: 'musicians', city: this.place(), instrument };
  }

  draftFor(m: BuilderMusician, instrument: string): string {
    const first = m.name.trim().split(/\s+/)[0] || m.name;
    return `¡Hola ${first}! Estoy armando una banda${this.scope()} y nos falta ${instrument.toLowerCase()}. ¿Te apetece quedar un día para probar?`;
  }

  async tryOut(m: BuilderMusician, instrument: string) {
    if (this.opening()) return;
    await this.session;
    if (!this.viewerId) { this.router.navigate(['/auth/login']); return; }
    this.opening.set(m.id);
    try {
      const result = await this.messages.getOrCreateConversation(m.user_id, m.name);
      if (!result) return;
      if ('error' in result) { this.toast.error(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: m.name, draft: this.draftFor(m, instrument) } });
    } catch {
      this.toast.error('No se pudo abrir la conversación.');
    } finally {
      this.opening.set(null);
    }
  }

  initials(name: string): string {
    const w = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '?';
  }
}
