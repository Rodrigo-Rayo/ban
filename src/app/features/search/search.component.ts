import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

type SearchType = 'musicians' | 'bands' | 'venues' | 'events' | 'teachers' | 'rehearsal';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, DatePipe, IconComponent],
  templateUrl: './search.component.html',
})
export class SearchComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  activeTab = signal<SearchType>('musicians');
  searchQuery = signal('');
  selectedGenre = signal('');
  selectedCity = signal('Toda España');
  selectedInstrument = signal('');
  filterAvailable = signal(false);
  loading = signal(false);

  musicians = signal<any[]>([]);
  events = signal<any[]>([]);
  bands = signal<any[]>([]);
  venues = signal<any[]>([]);
  teachers = signal<any[]>([]);
  rehearsals = signal<any[]>([]);


  genres = ['Todos', 'Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk'];
  cities = ['Toda España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];

  tabs: { id: SearchType; label: string; icon: string }[] = [
    { id: 'musicians', label: 'Músicos',         icon: 'music'      },
    { id: 'bands',     label: 'Bandas',          icon: 'mic'        },
    { id: 'venues',    label: 'Salas',           icon: 'building'   },
    { id: 'events',    label: 'Eventos',         icon: 'calendar'   },
    { id: 'teachers',  label: 'Clases',          icon: 'book-open'  },
    { id: 'rehearsal', label: 'Locales ensayo',  icon: 'headphones' },
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tab = (params['tab'] as SearchType) || 'musicians';
      this.activeTab.set(tab);
      if (params['city'])                  this.selectedCity.set(params['city']);
      if (params['genre'] !== undefined)   this.selectedGenre.set(params['genre'] || '');
      if (params['q'] !== undefined)       this.searchQuery.set(params['q'] || '');
      if (params['instrument'] !== undefined) this.selectedInstrument.set(params['instrument'] || '');
      if (params['available'] !== undefined) this.filterAvailable.set(params['available'] === 'true');
      this.loadData();
    });
  }

  tabLabel() {
    return this.tabs.find(t => t.id === this.activeTab())?.label ?? 'Resultados';
  }

  currentCount() {
    const tab = this.activeTab();
    if (tab === 'musicians') return this.musicians().length;
    if (tab === 'bands')     return this.bands().length;
    if (tab === 'venues')    return this.venues().length;
    if (tab === 'events')    return this.events().length;
    if (tab === 'teachers')  return this.teachers().length;
    if (tab === 'rehearsal') return this.rehearsals().length;
    return 0;
  }

  async setTab(tab: SearchType) {
    this.activeTab.set(tab);
    if (tab !== 'musicians') this.filterAvailable.set(false);
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    const tab = this.activeTab();
    const city = this.selectedCity();
    const genre = this.selectedGenre();
    const query = this.searchQuery().toLowerCase();

    if (tab === 'musicians') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client.from('musicians').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.ilike('genre', `%${genre}%`);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      if (this.filterAvailable()) q = q.eq('available', true);
      const { data } = await q.order('created_at', { ascending: false });
      this.musicians.set((data || []).filter(m => !query || m.name?.toLowerCase().includes(query) || m.instrument?.toLowerCase().includes(query)));
    }

    if (tab === 'events') {
      let q = this.supabase.client.from('events').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.eq('genre', genre);
      const { data } = await q.order('date', { ascending: true });
      this.events.set((data || []).filter(e => !query || e.title?.toLowerCase().includes(query)));
    }

    if (tab === 'bands') {
      let q = this.supabase.client.from('bands').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      if (genre && genre !== 'Todos') q = q.eq('genre', genre);
      const { data } = await q.order('created_at', { ascending: false });
      this.bands.set((data || []).filter(b => !query || b.name?.toLowerCase().includes(query)));
    }

    if (tab === 'venues') {
      let q = this.supabase.client.from('venues').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      const { data } = await q.order('created_at', { ascending: false });
      this.venues.set((data || []).filter(v => !query || v.name?.toLowerCase().includes(query)));
    }

    if (tab === 'teachers') {
      const instrument = this.selectedInstrument();
      let q = this.supabase.client.from('teachers').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      if (instrument) q = q.ilike('instrument', `%${instrument}%`);
      const { data } = await q.order('created_at', { ascending: false });
      this.teachers.set((data || []).filter(t => !query || t.name?.toLowerCase().includes(query) || t.instrument?.toLowerCase().includes(query)));
    }

    if (tab === 'rehearsal') {
      let q = this.supabase.client.from('rehearsal_spaces').select('*');
      if (city !== 'Toda España') q = q.eq('city', city);
      const { data } = await q.order('created_at', { ascending: false });
      this.rehearsals.set((data || []).filter(r => !query || r.name?.toLowerCase().includes(query)));
    }

    this.loading.set(false);
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
