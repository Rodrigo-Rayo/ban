import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { timeAgo } from '../../core/utils/display.utils';
import { localToday, dateParts as sharedDateParts } from '../../core/utils/date';
import { askLabel, askStampClass } from '../../core/utils/se-busca';
import { AvatarUploadService } from '../../core/services/avatar-upload.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../shared/components/avatar-upload/avatar-upload.component';
import { environment } from '../../../environments/environment';

interface HomeMusician { id: string; user_id?: string | null; name: string; city: string; instrument: string; avatar_url: string | null; created_at: string; }
interface HomeEvent { id: string; title: string; city: string; date: string; genre: string; description: string | null; venue?: string | null; created_at: string; }
interface HomeVenue { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; created_at: string; }
interface HomeRehearsal { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; hourly_rate?: number | null; created_at: string; }
interface HomePost { id: string; type: string; text: string; city: string | null; instrument: string | null; author_name: string; author_profile_type: string | null; author_profile_id: string | null; created_at: string; }
interface HomeListing { id: string; title: string; price: number | null; condition: string | null; category: string | null; city: string | null; images: string[] | null; created_at: string; }
interface HomeVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface HomeProfile { id?: string; name: string; city?: string | null; avatar_url?: string | null; }

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-home',
    imports: [RouterLink, DecimalPipe, AvatarUploadComponent, IconComponent],
    templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  readonly timeAgo = timeAgo;
  readonly askLabel = askLabel;
  readonly askStampClass = askStampClass;

  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private vacanciesSvc = inject(VacanciesService);
  private seo = inject(SeoService);
  private avatarUpload = inject(AvatarUploadService);

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
        if (profile.city) {
          this.userCity.set(profile.city);
          try { localStorage.setItem('bandyou_city', profile.city); } catch {}
        }
      }).catch((err: unknown) => { if (!environment.production) console.error('[Home] loadUserProfile failed:', err); });
    });
  }

  recentMusicians  = signal<HomeMusician[]>([]);
  recentEvents     = signal<HomeEvent[]>([]);
  recentVenues     = signal<HomeVenue[]>([]);
  recentRehearsals = signal<HomeRehearsal[]>([]);
  recentPosts      = signal<HomePost[]>([]);
  recentListings   = signal<HomeListing[]>([]);

  recentVacancies  = signal<HomeVacancy[]>([]);

  loading      = signal(true);
  loadError    = signal(false);
  userCity     = signal('');
  userProfile  = signal<HomeProfile | null>(null);

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
  /** New musicians, never the signed-in user. */
  readonly newPeople = computed(() => {
    const me = this.auth.user()?.id;
    return this.recentMusicians().filter(m => !me || m.user_id !== me).slice(0, 4);
  });
  /** True when the musicians list was filled from all of Spain (the user's city had too few). */
  musiciansNationwide = signal(false);
  /** Only musicians and bands play gigs, so only they get the "publish your gig" nudge. */
  readonly canPublishGigs = computed(() => ['musician', 'band'].includes(this.auth.userProfileType()));
  readonly displayCity = computed(() => this.userCity() || 'España');
  /** Vacancies from the user's city first. */
  readonly vacanciesSorted = computed(() => {
    const city = this.userCity();
    const list = [...this.recentVacancies()];
    return city ? list.sort((a, b) => Number(b.bands?.city === city) - Number(a.bands?.city === city)) : list;
  });
  /** Single most useful nudge, built only from data that exists. */
  readonly nextStep = computed<{ text: string; cta: string; link?: string; upload?: boolean } | null>(() => {
    const profile = this.userProfile();
    // The photo is saved on the profile row, so listeners (no row) never see this nudge.
    const hasPhoto = !!profile?.avatar_url || !!this.avatarUpload.avatarUrl();
    if (profile && !hasPhoto && this.auth.userProfileType() !== 'listener') {
      return { text: 'Añade una foto: los perfiles con foto reciben más mensajes.', cta: 'Añadir foto', upload: true };
    }
    return null;
  });

  async ngOnInit() {
    this.seo.set({ title: 'Portada', description: 'Músicos, bandas, salas y eventos cerca de ti. Conecta con la escena musical de España.' });
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

      const musicianCols   = 'id, user_id, name, city, instrument, avatar_url, created_at';
      const eventCols      = 'id, title, city, date, genre, description, venue, created_at';
      const venueCols      = 'id, name, city, avatar_url, capacity, created_at';
      const rehearsalCols  = 'id, name, city, avatar_url, capacity, hourly_rate, created_at';
      const postCols       = 'id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at';
      const listingCols    = 'id, title, price, condition, category, city, images, created_at';

      const [
        { data: musicians },
        { data: events },
        { data: venues },
        { data: rehearsals },
        { data: posts },
        { data: vacancies },
        { data: listings },
      ] = await Promise.all([
        city
          ? this.supabase.client.from('musicians').select(musicianCols).eq('city', city).order('created_at', { ascending: false }).limit(12)
          : this.supabase.client.from('musicians').select(musicianCols).order('created_at', { ascending: false }).limit(12),
        city
          ? this.supabase.client.from('events').select(eventCols).eq('city', city).gte('date', todayStr).order('date', { ascending: true }).limit(5)
          : this.supabase.client.from('events').select(eventCols).gte('date', todayStr).order('date', { ascending: true }).limit(5),
        city
          ? this.supabase.client.from('venues').select(venueCols).eq('city', city).order('created_at', { ascending: false }).limit(5)
          : this.supabase.client.from('venues').select(venueCols).order('created_at', { ascending: false }).limit(5),
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
        events: eventCols,
        venues: venueCols,
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

      this.recentMusicians.set(((musicians || []) as unknown as HomeMusician[]).slice(0, 8));
      this.recentEvents.set((events || []) as unknown as HomeEvent[]);
      this.recentVenues.set((venues || []) as unknown as HomeVenue[]);
      this.recentRehearsals.set((rehearsals || []) as unknown as HomeRehearsal[]);
      this.recentPosts.set(((posts || []) as unknown as HomePost[]).slice(0, 4));
      this.recentVacancies.set((vacancies || []) as unknown as HomeVacancy[]);
      this.recentListings.set(((listings || []) as unknown as HomeListing[]).slice(0, 6));

      // Fallbacks run in background and update signals when ready
      if (city) {
        if ((musicians?.length ?? 0) < 6) {
          globalFallback('musicians', 12).then(d => { this.musiciansNationwide.set(true); this.recentMusicians.set(d.slice(0, 8) as unknown as HomeMusician[]); }).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((events?.length ?? 0) < 2) {
          globalFallback('events', 5, q => q.gte('date', todayStr).order('date', { ascending: true })).then(d => this.recentEvents.set(d as unknown as HomeEvent[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
        }
        if ((venues?.length ?? 0) < 2) {
          globalFallback('venues', 5).then(d => this.recentVenues.set(d as unknown as HomeVenue[])).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
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
    this.musiciansNationwide.set(false);
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

  /** Event date parts for the poster date block. */
  dateParts(date: string): { weekday: string; day: string; month: string } {
    return sharedDateParts(date.slice(0, 10)) ?? { weekday: '', day: '', month: '' };
  }
}
