import { Component, signal, computed, inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { CITIES_WITH_ALL } from '../../core/constants/cities';
import { GENRES, INSTRUMENTS } from '../../core/constants/music.constants';
import { avatarColor } from '../../core/utils/display.utils';
import { environment } from '../../../environments/environment';
import { localToday } from '../../core/utils/date';
import { parseList } from '../../core/utils/list';
import { ListPipe } from '../../shared/pipes/list.pipe';
import { MediaFeaturesService } from '../../core/services/media-features.service';

type SearchType = 'musicians' | 'bands' | 'venues' | 'events' | 'teachers' | 'rehearsal';

interface MusicianResult { id: string; name: string; city: string; avatar_url: string | null; instrument: string; genre: string; availability_days?: string | null; created_at: string; user_id: string; }
interface BandResult { id: string; name: string; city: string; avatar_url: string | null; genre: string; looking_for?: string | null; created_at: string; user_id: string; }
interface VenueResult { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; genres: string | null; created_at: string; user_id: string; }
interface EventResult { id: string; title: string; venue: string; city: string; date: string; time: string | null; genre: string; description: string | null; price?: string | null; image_url?: string | null; created_at: string; user_id: string; }
interface TeacherResult { id: string; name: string; city: string; avatar_url: string | null; instrument: string; hourly_rate: number | null; modality?: string | null; created_at: string; user_id: string; }
interface RehearsalResult { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; hourly_rate: number | null; rooms_count?: number | null; created_at: string; user_id: string; }

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-search',
    imports: [FormsModule, RouterLink, CommonModule, DatePipe, ListPipe],
    templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit, OnDestroy {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private features = inject(MediaFeaturesService);

  activeTab = signal<SearchType>('musicians');
  searchQuery = signal('');
  selectedGenre = signal('');
  selectedCity = signal('Toda España');
  selectedInstrument = signal('');
  userCity = signal('');

  loading = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  searchError = signal(false);
  isLoggedIn = signal(false);
  private offset = 0;
  private readonly LIMIT = 30;
  private paramsSub?: Subscription;
  private fetchSeq = 0;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  musicians      = signal<MusicianResult[]>([]);
  events         = signal<EventResult[]>([]);
  bands          = signal<BandResult[]>([]);
  venues         = signal<VenueResult[]>([]);
  teachers       = signal<TeacherResult[]>([]);
  rehearsals     = signal<RehearsalResult[]>([]);


  genres = GENRES;
  cities = CITIES_WITH_ALL;
  instruments = INSTRUMENTS;

  tabs: { id: SearchType; label: string; icon: string }[] = [
    { id: 'musicians', label: 'Músicos',  icon: 'music'      },
    { id: 'bands',     label: 'Bandas',   icon: 'mic'        },
    { id: 'rehearsal', label: 'Locales',  icon: 'headphones' },
    { id: 'teachers',  label: 'Clases',   icon: 'book-open'  },
    { id: 'events',    label: 'Agenda',   icon: 'calendar'   },
    { id: 'venues',    label: 'Salas',    icon: 'building'   },
  ];

  /** Mobile: secondary filters (city, instrument, genre) collapse behind a toggle. */
  filtersOpen = signal(false);

  readonly weekdays = [
    { key: 'lunes', label: 'L', full: 'Lunes' },
    { key: 'martes', label: 'M', full: 'Martes' },
    { key: 'miercoles', label: 'X', full: 'Miércoles' },
    { key: 'jueves', label: 'J', full: 'Jueves' },
    { key: 'viernes', label: 'V', full: 'Viernes' },
    { key: 'sabado', label: 'S', full: 'Sábado' },
    { key: 'domingo', label: 'D', full: 'Domingo' },
  ];

  /** Normalised set of available weekday keys ('Miércoles' -> 'miercoles'). */
  availableDays(value: string | null | undefined): Set<string> {
    return new Set(parseList(value).map(d => d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  }

  async ngOnInit() {

    const { data: { user } } = await this.supabase.auth.getUser();
    this.isLoggedIn.set(!!user);

    // Cache user's city for default filtering
    if (user) {
      try {
        const cached = localStorage.getItem('bandyou_city');
        if (cached) this.userCity.set(cached);
      } catch {}
    }

    const tabTitles: Record<SearchType, string> = {
      musicians: 'Músicos en España',
      bands: 'Bandas de música',
      venues: 'Salas de conciertos',
      events: 'Agenda de eventos',
      teachers: 'Clases de música',
      rehearsal: 'Locales de ensayo',
    };

    this.paramsSub = this.route.queryParams.subscribe(params => {
      const rawTab = (params['tab'] as string) || 'musicians';
      // "Se busca" now lives in /feed (posts + band vacancies together).
      if (rawTab === 'vacancies') {
        this.router.navigate(['/feed'], { queryParams: { ver: 'bandas' }, replaceUrl: true });
        return;
      }
      const tab: SearchType = this.tabLabelMap.has(rawTab as SearchType) ? rawTab as SearchType : 'musicians';
      this.activeTab.set(tab);
      this.revealActiveTab();
      this.seo.set({
        title: tabTitles[tab] || 'Buscar',
        description: `Encuentra ${(tabTitles[tab] || 'músicos, bandas y salas').toLowerCase()} — BandYou`,
        url: 'https://bandyou.es/search',
      });
      if (params['city']) {
        this.selectedCity.set(params['city']);
      } else {
        this.selectedCity.set('Toda España');
      }
      // The URL is the source of truth: absent params mean "no filter" (previously a
      // filter from an earlier URL kept applying invisibly).
      this.selectedGenre.set(params['genre'] || '');
      this.selectedInstrument.set(params['instrument'] || '');
      // Don't overwrite text the user is still typing (debounced navigation pending).
      if (this.searchDebounceTimer === undefined) this.searchQuery.set(params['q'] || '');

      this.loadData();
    });
  }

  ngOnDestroy() {
    this.paramsSub?.unsubscribe();
    if (this.searchDebounceTimer !== undefined) clearTimeout(this.searchDebounceTimer);
  }

  private readonly tabLabelMap = new Map<SearchType, string>(this.tabs.map(t => [t.id, t.label]));

  /** Mobile tabs scroll horizontally: keep the active one in view. */
  private revealActiveTab() {
    setTimeout(() => document.getElementById('tab-' + this.activeTab())?.scrollIntoView({ block: 'nearest', inline: 'center' }), 0);
  }

  readonly tabLabel = computed(() => this.tabLabelMap.get(this.activeTab()) ?? 'Resultados');
  private static readonly PLACEHOLDERS: Record<string, string> = {
    musicians: 'Buscar músicos…',
    bands: 'Buscar bandas…',
    rehearsal: 'Buscar locales…',
    venues: 'Buscar salas…',
    events: 'Buscar eventos…',
    teachers: 'Buscar clases…',
  };
  readonly searchPlaceholder = computed(() => SearchComponent.PLACEHOLDERS[this.activeTab()] ?? 'Buscar…');

  readonly currentCount = computed(() => {
    const tab = this.activeTab();
    if (tab === 'musicians') return this.musicians().length;
    if (tab === 'bands')     return this.bands().length;
    if (tab === 'venues')    return this.venues().length;
    if (tab === 'events')    return this.events().length;
    if (tab === 'teachers')  return this.teachers().length;
    if (tab === 'rehearsal') return this.rehearsals().length;
    return 0;
  });

  readonly hasInstrumentFilter = computed(() => {
    const tab = this.activeTab();
    return tab === 'musicians' || tab === 'teachers';
  });

  /** " en Madrid" when a city is selected, nothing for "Toda España" (used in titles and empty states). */
  /** Page kicker: what the active category is about. */
  readonly tabKicker = computed(() => ({
    musicians: 'Gente que toca cerca de ti',
    bands: 'Bandas de toda España',
    rehearsal: 'Locales de ensayo',
    teachers: 'Clases de música',
    events: 'Conciertos, jams y festivales',
    venues: 'Salas de conciertos',
  } as Record<SearchType, string>)[this.activeTab()]);

  readonly cityScope = computed(() => this.selectedCity() !== 'Toda España' ? ' en ' + this.selectedCity() : '');
  readonly hasGenreFilter = computed(() => !['rehearsal', 'events', 'teachers'].includes(this.activeTab()));

  /** Number of secondary filters applied (city, instrument, genre). */
  readonly activeFilterCount = computed(() =>
    (this.selectedCity() !== 'Toda España' ? 1 : 0) +
    (this.selectedInstrument() ? 1 : 0) +
    (this.selectedGenre() ? 1 : 0)
  );

  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery() ||
    !!this.selectedGenre() ||
    this.selectedCity() !== 'Toda España' ||
    !!this.selectedInstrument()
  );

  async setTab(tab: SearchType) {
    this.activeTab.set(tab);
    this.revealActiveTab();
    this.selectedGenre.set('');
    const hasInstrumentTab = tab === 'musicians' || tab === 'teachers';
    if (!hasInstrumentTab) this.selectedInstrument.set('');
    this.filterChanged();
  }

  onSearchQueryChange(val: string) {
    this.searchQuery.set(val);
    if (this.searchDebounceTimer !== undefined) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = undefined;
      this.filterChanged();
    }, 400);
  }

  filterChanged() {
    const params: Record<string, string> = { tab: this.activeTab() };
    const city = this.selectedCity();
    if (city && city !== 'Toda España') params['city'] = city;
    const genre = this.selectedGenre();
    if (genre) params['genre'] = genre;
    const q = this.searchQuery();
    if (q) params['q'] = q;
    const inst = this.selectedInstrument();
    if (inst) params['instrument'] = inst;
    this.router.navigate([], { queryParams: params, replaceUrl: true });
  }

  async loadData() {
    this.offset = 0;
    this.hasMore.set(false);
    this.loading.set(true);
    const seq = ++this.fetchSeq;
    this.searchError.set(false);
    try {
      const data = await this.fetchPage(0);
      if (seq !== this.fetchSeq) return;
      this.setResults(data);
      this.hasMore.set(data.length === this.LIMIT);
    } catch (err) {
      if (!environment.production) console.error('[Search] fetchPage error:', err);
      this.searchError.set(true);
    } finally {
      if (seq === this.fetchSeq) this.loading.set(false);
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const seq = this.fetchSeq;
    try {
      this.offset += this.LIMIT;
      const data = await this.fetchPage(this.offset);
      // A filter change while loading started a new list: drop this stale page.
      if (seq !== this.fetchSeq) return;
      this.appendResults(data);
      this.hasMore.set(data.length === this.LIMIT);
    } catch {
      this.offset -= this.LIMIT;
    } finally {
      this.loadingMore.set(false);
    }
  }

  private setResults(data: unknown[]) {
    const tab = this.activeTab();
    if (tab === 'musicians') this.musicians.set(data as MusicianResult[]);
    else if (tab === 'events') this.events.set(data as EventResult[]);
    else if (tab === 'bands') this.bands.set(data as BandResult[]);
    else if (tab === 'venues') this.venues.set(data as VenueResult[]);
    else if (tab === 'teachers') this.teachers.set(data as TeacherResult[]);
    else if (tab === 'rehearsal') this.rehearsals.set(data as RehearsalResult[]);
  }

  private appendResults(data: unknown[]) {
    const tab = this.activeTab();
    if (tab === 'musicians') this.musicians.update(r => [...r, ...data as MusicianResult[]]);
    else if (tab === 'events') this.events.update(r => [...r, ...data as EventResult[]]);
    else if (tab === 'bands') this.bands.update(r => [...r, ...data as BandResult[]]);
    else if (tab === 'venues') this.venues.update(r => [...r, ...data as VenueResult[]]);
    else if (tab === 'teachers') this.teachers.update(r => [...r, ...data as TeacherResult[]]);
    else if (tab === 'rehearsal') this.rehearsals.update(r => [...r, ...data as RehearsalResult[]]);
  }

  private static readonly SEARCH_COLS = {
    musicians:  'id,name,city,avatar_url,instrument,genre,availability_days,created_at,user_id',
    bands:      'id,name,city,avatar_url,genre,looking_for,created_at,user_id',
    venues:     'id,name,city,avatar_url,capacity,genres,created_at,user_id',
    events:     'id,title,venue,city,date,time,genre,description,price,created_at,user_id',
    teachers:   'id,name,city,avatar_url,instrument,hourly_rate,modality,created_at,user_id',
    rehearsal:  'id,name,city,avatar_url,capacity,hourly_rate,created_at,user_id',
  } as const;

  private async fetchPage(offset: number): Promise<unknown[]> {
    const tab = this.activeTab();
    const city = this.selectedCity();
    const genre = this.selectedGenre();
    const query = this.searchQuery().toLowerCase();

    if (tab === 'musicians') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client.from('musicians').select(SearchComponent.SEARCH_COLS.musicians);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genre', `%${genre}%`);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      if (query) { q = q.ilike('name', `%${query}%`); }
      const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    if (tab === 'events') {
      // Poster thumbnails only once events.image_url exists (cached per session).
      const cols: string = (await this.features.has('eventImage'))
        ? `${SearchComponent.SEARCH_COLS.events},image_url` : SearchComponent.SEARCH_COLS.events;
      let q = this.supabase.client.from('events').select(cols).gte('date', localToday());
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.eq('genre', genre);
      if (query) q = q.ilike('title', `%${query}%`);
      const { data, error } = await q.order('date', { ascending: true }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    if (tab === 'bands') {
      let q = this.supabase.client.from('bands').select(SearchComponent.SEARCH_COLS.bands);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genre', `%${genre}%`);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    if (tab === 'venues') {
      let q = this.supabase.client.from('venues').select(SearchComponent.SEARCH_COLS.venues);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genres', `%${genre}%`);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    if (tab === 'teachers') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client.from('teachers').select(SearchComponent.SEARCH_COLS.teachers);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      if (query) { q = q.ilike('name', `%${query}%`); }
      const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    if (tab === 'rehearsal') {
      let q = this.supabase.client.from('rehearsal_spaces').select(SearchComponent.SEARCH_COLS.rehearsal);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      if (error) throw error;
      return data || [];
    }

    return [];
  }

  /** Why the list is empty decides the empty-state copy. */
  readonly emptyMode = computed<'query' | 'filters' | 'none'>(() =>
    this.searchQuery().trim() ? 'query'
      : (this.selectedCity() !== 'Toda España' || this.selectedInstrument() || this.selectedGenre()) ? 'filters' : 'none');

  /** Initials from first + last word ("Sofía López" -> "SL"). */
  initials(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/s+/).filter(Boolean);
    if (words.length === 0) return '?';
    const first = words[0].charAt(0);
    const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  clearFilters() {
    this.selectedGenre.set('');
    this.selectedCity.set(this.userCity() || 'Toda España');
    this.searchQuery.set('');
    this.selectedInstrument.set('');
    this.filterChanged();
  }

  async joinAs(role: string) {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      localStorage.setItem('bandyou_role', role);
      this.router.navigate(['/auth/register']);
      return;
    }
    // User is logged in — send to onboarding (they edit their existing profile or create new)
    this.router.navigate(['/onboarding']);
  }
}
