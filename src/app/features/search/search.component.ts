import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CITIES_WITH_ALL } from '../../core/constants/cities';
import { avatarColor } from '../../core/utils/display.utils';

type SearchType = 'musicians' | 'bands' | 'venues' | 'events' | 'teachers' | 'rehearsal' | 'vacancies';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, DatePipe, IconComponent],
  templateUrl: './search.component.html',
})
export class SearchComponent implements OnInit, OnDestroy {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);

  activeTab = signal<SearchType>('musicians');
  searchQuery = signal('');
  selectedGenre = signal('');
  selectedCity = signal('Toda España');
  selectedInstrument = signal('');
  userCity = signal('');

  loading = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  isLoggedIn = signal(false);
  private offset = 0;
  private readonly LIMIT = 30;
  private paramsSub?: Subscription;
  private fetchSeq = 0;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  musicians = signal<any[]>([]);
  events = signal<any[]>([]);
  bands = signal<any[]>([]);
  venues = signal<any[]>([]);
  teachers = signal<any[]>([]);
  rehearsals = signal<any[]>([]);
  vacancyResults = signal<any[]>([]);


  genres = ['Todos', 'Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Reggae', 'Punk', 'Clásico', 'Experimental', 'Bossa Nova'];
  cities = CITIES_WITH_ALL;

  tabs: { id: SearchType; label: string; icon: string }[] = [
    { id: 'musicians', label: 'Músicos',         icon: 'music'      },
    { id: 'bands',     label: 'Bandas',          icon: 'mic'        },
    { id: 'vacancies', label: 'Vacantes',        icon: 'megaphone'  },
    { id: 'venues',    label: 'Salas',           icon: 'building'   },
    { id: 'events',    label: 'Eventos',         icon: 'calendar'   },
    { id: 'teachers',  label: 'Clases',          icon: 'book-open'  },
    { id: 'rehearsal', label: 'Locales ensayo',  icon: 'headphones' },
  ];

  async ngOnInit() {
    this.seo.set({ title: 'Buscar', description: 'Encuentra músicos, bandas, locales y profesores de música en España.' });

    const { data: { user } } = await this.supabase.auth.getUser();
    this.isLoggedIn.set(!!user);

    // Cache user's city for default filtering
    if (user) {
      try {
        const cached = localStorage.getItem('bandyou_city');
        if (cached) this.userCity.set(cached);
      } catch {}
    }

    this.paramsSub = this.route.queryParams.subscribe(params => {
      const tab = (params['tab'] as SearchType) || 'musicians';
      this.activeTab.set(tab);
      if (params['city']) {
        this.selectedCity.set(params['city']);
      } else {
        this.selectedCity.set('Toda España');
      }
      if (params['genre'] !== undefined)   this.selectedGenre.set(params['genre'] || '');
      if (params['q'] !== undefined)       this.searchQuery.set(params['q'] || '');
      if (params['instrument'] !== undefined) this.selectedInstrument.set(params['instrument'] || '');

      this.loadData();
    });
  }

  ngOnDestroy() {
    this.paramsSub?.unsubscribe();
    if (this.searchDebounceTimer !== undefined) clearTimeout(this.searchDebounceTimer);
  }

  private readonly tabLabelMap = new Map(this.tabs.map(t => [t.id, t.label]));

  readonly tabLabel = computed(() => this.tabLabelMap.get(this.activeTab()) ?? 'Resultados');

  readonly currentCount = computed(() => {
    const tab = this.activeTab();
    if (tab === 'musicians') return this.musicians().length;
    if (tab === 'bands')     return this.bands().length;
    if (tab === 'venues')    return this.venues().length;
    if (tab === 'events')    return this.events().length;
    if (tab === 'teachers')  return this.teachers().length;
    if (tab === 'rehearsal') return this.rehearsals().length;
    if (tab === 'vacancies') return this.vacancyResults().length;
    return 0;
  });

  readonly hasActiveFilters = computed(() =>
    !!this.searchQuery() ||
    !!this.selectedGenre() ||
    this.selectedCity() !== 'Toda España' ||
    !!this.selectedInstrument()
  );

  async setTab(tab: SearchType) {
    this.activeTab.set(tab);
    this.selectedGenre.set('');
    const hasInstrumentTab = tab === 'musicians' || tab === 'teachers' || tab === 'vacancies';
    if (!hasInstrumentTab) this.selectedInstrument.set('');
    this.filterChanged();
  }

  onSearchQueryChange(val: string) {
    this.searchQuery.set(val);
    if (this.searchDebounceTimer !== undefined) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
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
    try {
      const data = await this.fetchPage(0);
      if (seq !== this.fetchSeq) return;
      this.setResults(data);
      this.hasMore.set(data.length === this.LIMIT);
    } catch {
      // Results stay as empty arrays — user sees empty state instead of crash
    } finally {
      if (seq === this.fetchSeq) this.loading.set(false);
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      this.offset += this.LIMIT;
      const data = await this.fetchPage(this.offset);
      this.appendResults(data);
      this.hasMore.set(data.length === this.LIMIT);
    } catch {
      this.offset -= this.LIMIT;
    } finally {
      this.loadingMore.set(false);
    }
  }

  private setResults(data: any[]) {
    const tab = this.activeTab();
    if (tab === 'musicians') this.musicians.set(data);
    else if (tab === 'events') this.events.set(data);
    else if (tab === 'bands') this.bands.set(data);
    else if (tab === 'venues') this.venues.set(data);
    else if (tab === 'teachers') this.teachers.set(data);
    else if (tab === 'rehearsal') this.rehearsals.set(data);
    else if (tab === 'vacancies') this.vacancyResults.set(data);
  }

  private appendResults(data: any[]) {
    const tab = this.activeTab();
    if (tab === 'musicians') this.musicians.update(r => [...r, ...data]);
    else if (tab === 'events') this.events.update(r => [...r, ...data]);
    else if (tab === 'bands') this.bands.update(r => [...r, ...data]);
    else if (tab === 'venues') this.venues.update(r => [...r, ...data]);
    else if (tab === 'teachers') this.teachers.update(r => [...r, ...data]);
    else if (tab === 'rehearsal') this.rehearsals.update(r => [...r, ...data]);
    else if (tab === 'vacancies') this.vacancyResults.update(r => [...r, ...data]);
  }

  private static readonly SEARCH_COLS = {
    musicians:  'id,name,city,avatar_url,instrument,genre,looking_for,created_at,user_id',
    bands:      'id,name,city,avatar_url,genre,looking_for,created_at,user_id',
    venues:     'id,name,city,avatar_url,capacity,genres,created_at,user_id',
    events:     'id,title,venue,city,date,time,genre,description,created_at,user_id',
    teachers:   'id,name,city,avatar_url,instrument,hourly_rate,created_at,user_id',
    rehearsal:  'id,name,city,avatar_url,capacity,hourly_rate,created_at,user_id',
  } as const;

  private async fetchPage(offset: number): Promise<any[]> {
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
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'events') {
      const localToday = new Date();
      const todayStr = `${localToday.getFullYear()}-${String(localToday.getMonth()+1).padStart(2,'0')}-${String(localToday.getDate()).padStart(2,'0')}`;
      let q = this.supabase.client.from('events').select(SearchComponent.SEARCH_COLS.events).gte('date', todayStr);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.eq('genre', genre);
      if (query) q = q.ilike('title', `%${query}%`);
      const { data } = await q.order('date', { ascending: true }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'bands') {
      let q = this.supabase.client.from('bands').select(SearchComponent.SEARCH_COLS.bands);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genre', `%${genre}%`);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'venues') {
      let q = this.supabase.client.from('venues').select(SearchComponent.SEARCH_COLS.venues);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genres', `%${genre}%`);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'teachers') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client.from('teachers').select(SearchComponent.SEARCH_COLS.teachers);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      if (genre && genre !== 'Todos') q = q.ilike('specialty', `%${genre}%`);
      if (query) { q = q.ilike('name', `%${query}%`); }
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'rehearsal') {
      let q = this.supabase.client.from('rehearsal_spaces').select(SearchComponent.SEARCH_COLS.rehearsal);
      if (city !== 'Toda España') q = q.eq('city', city);
      if (query) q = q.ilike('name', `%${query}%`);
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    if (tab === 'vacancies') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client
        .from('band_vacancies')
        .select('id, instrument, description, genre, created_at, bands!inner(id, name, city, avatar_url)')
        .eq('open', true);
      if (city !== 'Toda España') q = (q as any).eq('bands.city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genre', `%${genre}%`);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      if (query) q = q.ilike('instrument', `%${query}%`);
      const { data } = await q.order('created_at', { ascending: false }).range(offset, offset + this.LIMIT - 1);
      return data || [];
    }

    return [];
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
