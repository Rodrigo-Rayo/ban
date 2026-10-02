import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { MessagesService } from '../../core/services/messages.service';
import { avatarColor, timeAgo } from '../../core/utils/display.utils';
import { localToday } from '../../core/utils/date';
import { environment } from '../../../environments/environment';

interface HomeMusician { id: string; name: string; city: string; instrument: string; avatar_url: string | null; created_at: string; }
interface HomeBand { id: string; name: string; city: string; genre: string; avatar_url: string | null; looking_for?: string | null; created_at: string; }
interface HomeEvent { id: string; title: string; city: string; date: string; genre: string; description: string | null; venue?: string | null; created_at: string; }
interface HomeVenue { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; created_at: string; }
interface HomeTeacher { id: string; name: string; city: string; instrument: string; avatar_url: string | null; hourly_rate?: number | null; created_at: string; }
interface HomeRehearsal { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; hourly_rate?: number | null; created_at: string; }
interface HomePost { id: string; type: string; text: string; city: string | null; instrument: string | null; author_name: string; author_profile_type: string | null; author_profile_id: string | null; created_at: string; }
interface HomeListing { id: string; title: string; price: number | null; condition: string | null; category: string | null; city: string | null; images: string[] | null; created_at: string; }
interface HomeVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface HomeProfile { id?: string; name: string; city?: string | null; avatar_url?: string | null; }

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-home',
    imports: [RouterLink, DecimalPipe],
    templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  readonly avatarColor = avatarColor;
  readonly timeAgo = timeAgo;

  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private vacanciesSvc = inject(VacanciesService);
  private seo = inject(SeoService);
  private messages = inject(MessagesService);

  constructor() {
    // Watch the auth user signal. When the user becomes available (which may be
    // after the initial render on SPA navigation), load the profile to get the
    // personalized city. Does NOT block the data queries in ngOnInit.
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      this.auth.loadUserProfile(user.id).then(() => {
        const profile = this.auth.userProfileData();
        if (!profile) return;
        this.userProfile.set(profile);
        this.userType.set(this.auth.userProfileType());
        if (profile.city) {
          this.userCity.set(profile.city);
          try { localStorage.setItem('bandyou_city', profile.city); } catch {}
        }
      }).catch((err: unknown) => { if (!environment.production) console.error('[Home] loadUserProfile failed:', err); });
    });
  }

  recentMusicians  = signal<HomeMusician[]>([]);
  recentBands      = signal<HomeBand[]>([]);
  recentEvents     = signal<HomeEvent[]>([]);
  recentVenues     = signal<HomeVenue[]>([]);
  recentTeachers   = signal<HomeTeacher[]>([]);
  recentRehearsals = signal<HomeRehearsal[]>([]);
  recentPosts      = signal<HomePost[]>([]);
  recentListings   = signal<HomeListing[]>([]);

  recentVacancies  = signal<HomeVacancy[]>([]);

  loading      = signal(true);
  loadError    = signal(false);
  userCity     = signal('');
  userProfile  = signal<HomeProfile | null>(null);
  userType     = signal('');

  today = new Date();

  /** Upcoming events only (never past ones), soonest first. */
  readonly upcomingEvents = computed(() => {
    const today = localToday();
    return this.recentEvents().filter(e => (e.date ?? '').slice(0, 10) >= today);
  });
  readonly featuredEvent = computed(() => this.upcomingEvents()[0] ?? null);
  readonly moreEvents = computed(() => this.upcomingEvents().slice(1, 4));
  readonly featuredRehearsal = computed(() => this.recentRehearsals()[0] ?? null);
  readonly otherRehearsals = computed(() => this.recentRehearsals().slice(1, 4));
  readonly displayCity = computed(() => this.userCity() || 'España');
  /** Vacancies from the user's city first. */
  readonly vacanciesSorted = computed(() => {
    const city = this.userCity();
    const list = [...this.recentVacancies()];
    return city ? list.sort((a, b) => Number(b.bands?.city === city) - Number(a.bands?.city === city)) : list;
  });
  /** Single most useful nudge, built only from data that exists. */
  readonly nextStep = computed<{ text: string; cta: string; link: string } | null>(() => {
    const unread = this.messages.unreadCount();
    if (unread > 0) {
      return { text: unread === 1 ? 'Tienes 1 mensaje sin leer.' : `Tienes ${unread} mensajes sin leer.`, cta: 'Leer', link: '/inbox' };
    }
    const profile = this.userProfile();
    if (profile && !profile.avatar_url) {
      return { text: 'Añade una foto: los perfiles con foto reciben más mensajes.', cta: 'Añadir', link: '/onboarding' };
    }
    return null;
  });

  readonly postTypeMap: Record<string, { label: string; icon: string }> = {
    musician_seeking_band: { label: 'Músico busca banda', icon: 'music'         },
    band_seeking_musician: { label: 'Banda busca músico', icon: 'mic'           },
    event_announcement:    { label: 'Anuncia un evento',  icon: 'calendar'      },
    session_offer:         { label: 'Ofrezco sesión',     icon: 'mic'           },
    gear_sale:             { label: 'Vendo equipamiento',  icon: 'shopping-cart' },
    looking_for_rehearsal: { label: 'Busco local ensayo', icon: 'headphones'    },
    collab:                { label: 'Busco colaboración', icon: 'users'         },
    other:                 { label: 'Anuncio',            icon: 'newspaper'     },
  };

  async ngOnInit() {
    this.seo.set({ title: 'Inicio', description: 'Músicos, bandas, salas y eventos cerca de ti. Conecta con la escena musical de España.' });
    await this.loadContent();
  }

  private async loadContent() {
    try {
      // Read city from cache synchronously — no network round-trip, no timing issues.
      // Profile personalization is handled reactively via effect() in the constructor.
      let cachedCity = '';
      try { cachedCity = localStorage.getItem('bandyou_city') || ''; } catch {}
      this.userCity.set(cachedCity);

      const city = this.userCity();
      const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

      const musicianCols   = 'id, name, city, instrument, avatar_url, created_at';
      const bandCols       = 'id, name, city, genre, avatar_url, created_at';
      const eventCols      = 'id, title, city, date, genre, description, venue, created_at';
      const venueCols      = 'id, name, city, avatar_url, capacity, created_at';
      const teacherCols    = 'id, name, city, instrument, avatar_url, hourly_rate, created_at';
      const rehearsalCols  = 'id, name, city, avatar_url, capacity, hourly_rate, created_at';
      const postCols       = 'id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at';
      const listingCols    = 'id, title, price, condition, category, city, images, created_at';

      const [
        { data: musicians },
        { data: bands },
        { data: events },
        { data: venues },
        { data: teachers },
        { data: rehearsals },
        { data: posts },
        { data: vacancies },
        { data: listings },
      ] = await Promise.all([
        city
          ? this.supabase.client.from('musicians').select(musicianCols).eq('city', city).order('created_at', { ascending: false }).limit(12)
          : this.supabase.client.from('musicians').select(musicianCols).order('created_at', { ascending: false }).limit(12),
        city
          ? this.supabase.client.from('bands').select(bandCols).eq('city', city).order('created_at', { ascending: false }).limit(12)
          : this.supabase.client.from('bands').select(bandCols).order('created_at', { ascending: false }).limit(12),
        city
          ? this.supabase.client.from('events').select(eventCols).eq('city', city).gte('date', todayStr).order('date', { ascending: true }).limit(5)
          : this.supabase.client.from('events').select(eventCols).gte('date', todayStr).order('date', { ascending: true }).limit(5),
        city
          ? this.supabase.client.from('venues').select(venueCols).eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('venues').select(venueCols).order('created_at', { ascending: false }).limit(5),
        city
          ? this.supabase.client.from('teachers').select(teacherCols).eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('teachers').select(teacherCols).order('created_at', { ascending: false }).limit(5),
        city
          ? this.supabase.client.from('rehearsal_spaces').select(rehearsalCols).eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('rehearsal_spaces').select(rehearsalCols).order('created_at', { ascending: false }).limit(5),
        this.supabase.client.from('posts').select(postCols).order('created_at', { ascending: false }).limit(4),
        // Non-critical module: a failure just hides "Se busca".
        this.vacanciesSvc.listOpen({ limit: 6 }).then(data => ({ data }), () => ({ data: [] })),
        this.supabase.client.from('gear_listings').select(listingCols).eq('status', 'active').order('created_at', { ascending: false }).limit(6),
      ]);

      const fallbackCols: Record<string, string> = {
        musicians: musicianCols,
        bands: bandCols,
        events: eventCols,
        venues: venueCols,
        teachers: teacherCols,
        rehearsal_spaces: rehearsalCols,
      };
      // extraFilter uses `any` because Supabase's PostgrestFilterBuilder generic is too complex to type here
      const globalFallback = async (table: string, limit: number, extraFilter?: (q: any) => any): Promise<Record<string, unknown>[]> => {
        const cols = fallbackCols[table] ?? 'id, name, city, avatar_url, created_at';
        let q = this.supabase.client.from(table).select(cols).order('created_at', { ascending: false }).limit(limit);
        if (extraFilter) q = extraFilter(q);
        const { data } = await q;
        return (data as unknown as Record<string, unknown>[]) || [];
      };

      this.recentMusicians.set(((musicians || []) as unknown as HomeMusician[]).slice(0, 6));
      this.recentBands.set(((bands || []) as unknown as HomeBand[]).slice(0, 6));
      this.recentEvents.set((events || []) as unknown as HomeEvent[]);
      this.recentVenues.set((venues || []) as unknown as HomeVenue[]);
      this.recentTeachers.set((teachers || []) as unknown as HomeTeacher[]);
      this.recentRehearsals.set((rehearsals || []) as unknown as HomeRehearsal[]);
      this.recentPosts.set(((posts || []) as unknown as HomePost[]).slice(0, 4));
      this.recentVacancies.set((vacancies || []) as unknown as HomeVacancy[]);
      this.recentListings.set(((listings || []) as unknown as HomeListing[]).slice(0, 6));

      // Fallbacks run in background and update signals when ready
      if (city) {
        if ((musicians?.length ?? 0) < 6) {
          globalFallback('musicians', 12).then(d => this.recentMusicians.set(d.slice(0, 6) as unknown as HomeMusician[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((bands?.length ?? 0) < 6) {
          globalFallback('bands', 12).then(d => this.recentBands.set(d.slice(0, 6) as unknown as HomeBand[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((events?.length ?? 0) < 2) {
          globalFallback('events', 5, q => q.gte('date', todayStr).order('date', { ascending: true })).then(d => this.recentEvents.set(d as unknown as HomeEvent[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((venues?.length ?? 0) < 2) {
          globalFallback('venues', 5).then(d => this.recentVenues.set(d as unknown as HomeVenue[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((teachers?.length ?? 0) < 2) {
          globalFallback('teachers', 5).then(d => this.recentTeachers.set(d as unknown as HomeTeacher[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((rehearsals?.length ?? 0) < 2) {
          globalFallback('rehearsal_spaces', 5).then(d => this.recentRehearsals.set(d as unknown as HomeRehearsal[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
      }
    } catch (err) {
      if (!environment.production) console.error('[Home] loadContent error:', err);
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  retryLoad() {
    this.loadError.set(false);
    this.loading.set(true);
    this.loadContent();
  }


  /** ISO week number, for the masthead dateline. */
  readonly weekNumber = (() => {
    const d = new Date(Date.UTC(this.today.getFullYear(), this.today.getMonth(), this.today.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  })();

  /** Event date parts for the poster date block (local time, no TZ shift). */
  dateParts(date: string): { weekday: string; day: string; month: string } {
    const d = new Date(`${date.slice(0, 10)}T00:00:00`);
    const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-ES', o).replace('.', '');
    return { weekday: fmt({ weekday: 'short' }), day: String(d.getDate()), month: fmt({ month: 'short' }) };
  }

  postInfo(type: string) {
    return this.postTypeMap[type] ?? { label: 'Anuncio', icon: 'newspaper' };
  }

  isNearby(item: { city: string | null }): boolean {
    return !!this.userCity() && item.city === this.userCity();
  }
}
