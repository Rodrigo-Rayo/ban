import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { timeAgo, avatarColor } from '../../core/utils/display.utils';
import { localToday, dateParts as sharedDateParts } from '../../core/utils/date';
import { askLabel, askStampClass } from '../../core/utils/se-busca';
import { AvatarUploadService } from '../../core/services/avatar-upload.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../shared/components/avatar-upload/avatar-upload.component';
import { environment } from '../../../environments/environment';
import { PostType } from '../../core/models';

interface HomeMusician { id: string; user_id?: string | null; name: string; city: string; instrument: string; avatar_url: string | null; created_at: string; }
interface HomeEvent { id: string; title: string; city: string; date: string; genre: string; description: string | null; venue?: string | null; created_at: string; }
interface HomeVenue { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; created_at: string; }
interface HomeRehearsal { id: string; name: string; city: string; avatar_url: string | null; capacity: number | null; hourly_rate?: number | null; created_at: string; }
interface HomePost { id: string; type: string; text: string; city: string | null; instrument: string | null; author_name: string; author_profile_type: string | null; author_profile_id: string | null; created_at: string; }
interface HomeListing { id: string; title: string; price: number | null; condition: string | null; category: string | null; city: string | null; images: string[] | null; created_at: string; }
interface HomeVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface HomeProfile { id?: string; name: string; city?: string | null; avatar_url?: string | null; }

/** One row of the merged "Se busca" list (band vacancies + board posts). */
export interface SeBuscaItem { id: string; title: string; stampClass: string; stampLabel: string; meta: string; link: unknown[]; }

/**
 * A slide of the "Destacado" carousel. Today it is filled from real content
 * (next gig, rehearsal space, a band that needs people, newest gear); it is the
 * slot reserved for paid promotion later, so the shape stays generic.
 */
export interface FeaturedSlide {
  key: string; kicker: string; title: string; meta: string; cta: string;
  link: unknown[]; tone: 'ink' | 'yellow' | 'red';
  /** Paid placement: shows a "Promo" tag. */
  sponsored?: boolean;
  date?: { weekday: string; day: string; month: string };
}

/** Section shortcuts on the home, in the same order as the masthead. */
export const HOME_SECTIONS: readonly { label: string; hint: string; icon: string; link: string; query?: Record<string, string> }[] = [
  { label: 'Se busca', hint: 'Bandas y músicos',  icon: 'megaphone',     link: '/feed' },
  { label: 'Músicos',  hint: 'Por instrumento',   icon: 'music',         link: '/search', query: { tab: 'musicians' } },
  { label: 'Bandas',   hint: 'Proyectos activos', icon: 'users',         link: '/search', query: { tab: 'bands' } },
  { label: 'Locales',  hint: 'Ensayo por horas',  icon: 'headphones',    link: '/search', query: { tab: 'rehearsal' } },
  { label: 'Clases',   hint: 'Profesores',        icon: 'book-open',     link: '/search', query: { tab: 'teachers' } },
  { label: 'Agenda',   hint: 'Conciertos',        icon: 'calendar',      link: '/search', query: { tab: 'events' } },
  { label: 'Salas',    hint: 'Música en directo', icon: 'building',      link: '/search', query: { tab: 'venues' } },
  { label: 'Tienda',   hint: 'Segunda mano',      icon: 'shopping-cart', link: '/shop' },
];

const SE_BUSCA_LIMIT = 5;
const NEW_PEOPLE_LIMIT = 8;

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-home',
    imports: [RouterLink, DecimalPipe, AvatarUploadComponent, IconComponent],
    templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  readonly timeAgo = timeAgo;
  readonly avatarColor = avatarColor;
  readonly sections = HOME_SECTIONS;
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
          // The first load used the cached city (or none): reload for the profile's city.
          if (this.loadedCity !== null && this.loadedCity !== profile.city) this.retryLoad();
        }
      }).catch((err: unknown) => { if (!environment.production) console.error('[Home] loadUserProfile failed:', err); });
    });
  }

  /** City the content was loaded for (null until the first load starts). */
  private loadedCity: string | null = null;
  private loadSeq = 0;

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
    return this.recentMusicians().filter(m => !me || m.user_id !== me).slice(0, NEW_PEOPLE_LIMIT);
  });
  /** First name for the greeting ("Hola, Lola"). */
  readonly firstName = computed(() => (this.userProfile()?.name ?? '').trim().split(/\s+/)[0] ?? '');

  /**
   * One "Se busca" list: open vacancies (user's city first), then board posts.
   * A band's "buscamos músico" post is skipped when that band already shows a vacancy.
   */
  readonly seBuscaItems = computed<SeBuscaItem[]>(() => {
    const vacancies: SeBuscaItem[] = this.vacanciesSorted()
      .filter(v => !!v.bands)
      .map(v => ({
        id: 'v-' + v.id,
        title: v.bands!.name,
        stampClass: askStampClass('vacancy'),
        stampLabel: askLabel('vacancy', v.instrument),
        meta: [v.genre || v.bands!.genre, v.bands!.city].filter(Boolean).join(' · '),
        link: ['/bands', v.bands!.id],
      }));
    const bandsWithVacancy = new Set(vacancies.map(v => v.title.toLowerCase()));
    const posts: SeBuscaItem[] = this.recentPosts()
      .filter(p => !(p.type === 'band_seeking_musician' && bandsWithVacancy.has(p.author_name.toLowerCase())))
      .map(p => ({
        id: 'p-' + p.id,
        title: p.author_name,
        stampClass: askStampClass(p.type as PostType),
        stampLabel: askLabel(p.type as PostType, p.instrument),
        meta: [p.city, timeAgo(p.created_at)].filter(Boolean).join(' · '),
        link: ['/posts', p.id],
      }));
    return [...vacancies.slice(0, 3), ...posts].slice(0, SE_BUSCA_LIMIT);
  });


  /** "Destacado" carousel slides, built only from content that exists. */
  readonly featuredSlides = computed<FeaturedSlide[]>(() => {
    const slides: FeaturedSlide[] = [];
    const ev = this.featuredEvent();
    if (ev) {
      slides.push({
        key: 'ev-' + ev.id, kicker: 'Próximo concierto', title: ev.title, tone: 'ink', cta: 'Ver concierto',
        meta: [ev.venue, ev.city].filter(Boolean).join(', '), link: ['/events', ev.id], date: this.dateParts(ev.date),
      });
    }
    const venue = this.recentVenues()[0];
    if (venue) {
      slides.push({
        key: 'vn-' + venue.id, kicker: 'Sala', title: venue.name, tone: 'red', cta: 'Ver sala',
        meta: [venue.city, venue.capacity ? `${venue.capacity} personas` : ''].filter(Boolean).join(' · '), link: ['/venues', venue.id],
      });
    }
    const r = this.featuredRehearsal();
    if (r) {
      slides.push({
        key: 'r-' + r.id, kicker: 'Local de ensayo', title: r.name, tone: 'yellow', cta: 'Ver local',
        meta: [r.city, r.hourly_rate ? `${r.hourly_rate} €/h` : '', r.capacity ? `${r.capacity} personas` : ''].filter(Boolean).join(' · '),
        link: ['/rehearsal', r.id],
      });
    }
    const g = this.recentListings()[0];
    if (g) {
      slides.push({
        key: 'g-' + g.id, kicker: 'Nuevo en la tienda', title: g.title, tone: 'ink', cta: 'Ver anuncio',
        meta: [g.price ? `${g.price} €` : '', g.city].filter(Boolean).join(' · '), link: ['/shop', g.id],
      });
    }
    return slides;
  });
  /** Index of the slide in view (drives the dots). */
  readonly activeSlide = signal(0);

  onCarouselScroll(el: HTMLElement) {
    const slides = Array.from(el.children) as HTMLElement[];
    if (!slides.length) return;
    // At the end of the track the last slide is the active one, even when two fit on screen.
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    const origin = slides[0].offsetLeft;
    const i = atEnd ? slides.length - 1 : slides.reduce((best, s, idx) =>
      Math.abs(s.offsetLeft - origin - el.scrollLeft) < Math.abs(slides[best].offsetLeft - origin - el.scrollLeft) ? idx : best, 0);
    if (i !== this.activeSlide()) this.activeSlide.set(i);
  }

  goToSlide(el: HTMLElement, i: number) {
    const slide = el.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }
  /** True when the musicians list was filled from all of Spain (the user's city had too few). */
  musiciansNationwide = signal(false);
  /** True when "Se busca" fell back to all of Spain (nothing in the user's city). */
  seBuscaNationwide = signal(false);
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
      const city = this.userCity() || cachedCity;
      this.userCity.set(city);
      this.loadedCity = city;
      const seq = ++this.loadSeq;
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
        this.seBuscaPostsQuery(postCols, city),
        // Non-critical module: a failure just hides "Se busca".
        this.vacanciesSvc.listOpen({ city: city || null, limit: 6 }).then(data => ({ data }), () => ({ data: [] })),
        this.supabase.client.from('gear_listings').select(listingCols).eq('status', 'active').order('created_at', { ascending: false }).limit(6),
      ]);

      // A newer load (e.g. for the profile's city) started meanwhile: drop this one.
      if (seq !== this.loadSeq) return;

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

      this.recentMusicians.set(((musicians || []) as unknown as HomeMusician[]).slice(0, NEW_PEOPLE_LIMIT + 1));
      this.recentEvents.set((events || []) as unknown as HomeEvent[]);
      this.recentVenues.set((venues || []) as unknown as HomeVenue[]);
      this.recentRehearsals.set((rehearsals || []) as unknown as HomeRehearsal[]);
      this.recentPosts.set((posts || []) as unknown as HomePost[]);
      this.recentVacancies.set((vacancies || []) as unknown as HomeVacancy[]);
      this.recentListings.set(((listings || []) as unknown as HomeListing[]).slice(0, 6));

      // Fallbacks run in background and update signals when ready
      if (city && !(posts?.length) && !(vacancies?.length)) {
        // Nothing wanted in the user's city yet: show all of Spain and say so.
        Promise.all([
          this.seBuscaPostsQuery(postCols, ''),
          this.vacanciesSvc.listOpen({ limit: 6 }).catch(() => []),
        ]).then(([{ data: p }, v]) => {
          this.seBuscaNationwide.set(true);
          this.recentPosts.set((p || []) as unknown as HomePost[]);
          this.recentVacancies.set(v as unknown as HomeVacancy[]);
        }).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
      }
      if (city) {
        if ((musicians?.length ?? 0) < 6) {
          globalFallback('musicians', 12).then(d => { this.musiciansNationwide.set(true); this.recentMusicians.set(d.slice(0, NEW_PEOPLE_LIMIT + 1) as unknown as HomeMusician[]); }).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
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

  /** Latest board posts, from one city or (empty city) all of Spain. */
  private seBuscaPostsQuery(cols: string, city: string) {
    const q = this.supabase.client.from('posts').select(cols).order('created_at', { ascending: false }).limit(8);
    return city ? q.eq('city', city) : q;
  }

  retryLoad() {
    this.loadError.set(false);
    this.seBuscaNationwide.set(false);
    this.musiciansNationwide.set(false);
    this.loading.set(true);
    this.loadContent();
  }



  /** Event date parts for the poster date block. */
  dateParts(date: string): { weekday: string; day: string; month: string } {
    return sharedDateParts(date.slice(0, 10)) ?? { weekday: '', day: '', month: '' };
  }
}
