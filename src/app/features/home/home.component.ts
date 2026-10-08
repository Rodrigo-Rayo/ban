import { QuedadaStatusComponent } from '../quedada/quedada-status.component';
import { RetoBannerComponent } from '../reto/reto-banner.component';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { SeoService } from '../../core/services/seo.service';
import { timeAgo, avatarColor } from '../../core/utils/display.utils';
import { localToday, dateParts as sharedDateParts } from '../../core/utils/date';
import { askLabel, askStampClass, SE_BUSCA_MAX_DAYS, sinceISO } from '../../core/utils/se-busca';
import { AvatarUploadService } from '../../core/services/avatar-upload.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../shared/components/avatar-upload/avatar-upload.component';
import { environment } from '../../../environments/environment';
import { PostType } from '../../core/models';

interface HomeMusician { id: string; user_id?: string | null; name: string; city: string; instrument: string; avatar_url: string | null; created_at: string; }
interface HomeEvent { id: string; title: string; city: string; date: string; genre: string; description: string | null; venue?: string | null; created_at: string; }
interface HomeVenue { id: string; user_id?: string | null; name: string; city: string; avatar_url: string | null; capacity: number | null; created_at: string; }
interface HomeRehearsal { id: string; user_id?: string | null; name: string; city: string; avatar_url: string | null; capacity: number | null; hourly_rate?: number | null; created_at: string; }
interface HomePost { id: string; type: string; title?: string | null; text: string; city: string | null; instrument: string | null; author_name: string; author_profile_type: string | null; author_profile_id: string | null; created_at: string; }
interface HomeListing { id: string; title: string; price: number | null; condition: string | null; category: string | null; city: string | null; images: string[] | null; created_at: string; }
interface HomeVacancy { id: string; instrument: string; genre: string | null; bands: { id: string; name: string; city: string | null; genre: string | null } | null; }
interface HomeBand { id: string; user_id?: string | null; name: string; city: string; genre: string | null; avatar_url: string | null; created_at: string; }
interface HomeTeacher { id: string; user_id?: string | null; name: string; city: string; instrument: string | null; avatar_url: string | null; created_at: string; }
/** One tile of "Gente nueva": any profile type. */
export interface NewPerson { key: string; id: string; name: string; city: string; avatar_url: string | null; label: string; link: string[]; created_at: string; }
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

/**
 * Tiny seeded PRNG (mulberry32): one random seed per visit gives picks that stay
 * the same while the page re-renders, and change on the next visit.
 */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The user's city first, then the rest of Spain to fill up to `limit` (no duplicates).
 * Both lists keep their own order (newest / soonest first).
 */
export function cityFirst<T extends { id: string }>(local: readonly T[], all: readonly T[], limit: number): T[] {
  const seen = new Set(local.map(x => x.id));
  return [...local, ...all.filter(x => !seen.has(x.id))].slice(0, limit);
}

const SE_BUSCA_LIMIT = 5;
const NEW_PEOPLE_LIMIT = 8;

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-home',
    imports: [RouterLink, DecimalPipe, AvatarUploadComponent, IconComponent, QuedadaStatusComponent, RetoBannerComponent],
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
  private features = inject(MediaFeaturesService);

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
          // Quietly: what is on screen stays until the new lists arrive (no skeleton flash).
          if (this.loadedCity !== null && this.loadedCity !== profile.city) this.reloadForCity();
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
  recentBands      = signal<HomeBand[]>([]);
  recentTeachers   = signal<HomeTeacher[]>([]);
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
  /** Newest profiles of every type (musicians, bands, teachers, venues, rehearsal spaces), never the signed-in user. */
  readonly newPeople = computed<NewPerson[]>(() => {
    const me = this.auth.user()?.id;
    const city = this.userCity();
    const all: (NewPerson & { user_id?: string | null })[] = [
      ...this.recentMusicians().map(m => ({ ...m, key: 'm-' + m.id, label: m.instrument || 'Músico', link: ['/musicians', m.id] })),
      ...this.recentBands().map(b => ({ ...b, key: 'b-' + b.id, label: b.genre ? `Banda · ${b.genre}` : 'Banda', link: ['/bands', b.id] })),
      ...this.recentTeachers().map(t => ({ ...t, key: 't-' + t.id, label: t.instrument ? `Clases · ${t.instrument}` : 'Clases', link: ['/teachers', t.id] })),
      ...this.recentVenues().map(v => ({ ...v, key: 'v-' + v.id, label: 'Sala', link: ['/venues', v.id] })),
      ...this.recentRehearsals().map(r => ({ ...r, key: 'r-' + r.id, label: 'Local de ensayo', link: ['/rehearsal', r.id] })),
    ];
    // Same city first, then people with a photo; within that, newest first (stable for ties).
    const rank = (p: NewPerson) => (city && p.city === city ? 0 : 2) + (p.avatar_url ? 0 : 1);
    return all
      .filter(p => !me || p.user_id !== me)
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rank(a.p) - rank(b.p) || (b.p.created_at || '').localeCompare(a.p.created_at || '') || a.i - b.i)
      .map(x => ({ key: x.p.key, id: x.p.id, name: x.p.name, city: x.p.city, avatar_url: x.p.avatar_url, label: x.p.label, link: x.p.link, created_at: x.p.created_at }))
      .slice(0, NEW_PEOPLE_LIMIT);
  });
  /** Rehearsal spaces: the user's city first, each group in a random order per visit. */
  readonly rehearsalsShown = computed(() => {
    const city = this.userCity();
    const rnd = seededRandom(this.featuredSeed() + 1);
    const list = this.recentRehearsals();
    return [...shuffled(list.filter(r => r.city === city), rnd), ...shuffled(list.filter(r => r.city !== city), rnd)];
  });
  /** First name for the greeting ("Hola, Lola"). */
  readonly firstName = computed(() => (this.userProfile()?.name ?? '').trim().split(/\s+/)[0] ?? '');

  /**
   * One "Se busca" list: open vacancies (user's city first), then board posts.
   * A band's "buscamos músico" post is skipped when that band already shows a vacancy.
   */
  /** Destacado carousel: off while La quedada takes its place; back on with paid promotions. */
  readonly showFeatured = false;

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
        // Titled posts lead with the title and move the author to the small line.
        title: p.title?.trim() || p.author_name,
        stampClass: askStampClass(p.type as PostType),
        stampLabel: askLabel(p.type as PostType, p.instrument),
        meta: [p.title?.trim() ? p.author_name : null, p.city, timeAgo(p.created_at)].filter(Boolean).join(' · '),
        link: ['/posts', p.id],
      }));
    return [...vacancies.slice(0, 3), ...posts].slice(0, SE_BUSCA_LIMIT);
  });


  /**
   * Seed for the "Destacado" draw. New on every visit; until paid promotion
   * exists, every gig, venue, rehearsal space and listing gets its turn.
   */
  readonly featuredSeed = signal(Math.floor(Math.random() * 2 ** 31));

  /** "Destacado" carousel: one random item per kind, in random order, only from content that exists. */
  readonly featuredSlides = computed<FeaturedSlide[]>(() => {
    const rnd = seededRandom(this.featuredSeed());
    const pick = <T>(list: readonly T[]): T | undefined => list.length ? list[Math.floor(rnd() * list.length)] : undefined;
    const slides: FeaturedSlide[] = [];
    const ev = pick(this.upcomingEvents());
    if (ev) {
      slides.push({
        key: 'ev-' + ev.id, kicker: 'Concierto', title: ev.title, tone: 'ink', cta: 'Ver concierto',
        meta: [ev.venue, ev.city].filter(Boolean).join(', '), link: ['/events', ev.id], date: this.dateParts(ev.date),
      });
    }
    const venue = pick(this.recentVenues());
    if (venue) {
      slides.push({
        key: 'vn-' + venue.id, kicker: 'Sala', title: venue.name, tone: 'red', cta: 'Ver sala',
        meta: [venue.city, venue.capacity ? `${venue.capacity} personas` : ''].filter(Boolean).join(' · '), link: ['/venues', venue.id],
      });
    }
    const r = pick(this.recentRehearsals());
    if (r) {
      slides.push({
        key: 'r-' + r.id, kicker: 'Local de ensayo', title: r.name, tone: 'yellow', cta: 'Ver local',
        meta: [r.city, r.hourly_rate ? `${r.hourly_rate} €/h` : '', r.capacity ? `${r.capacity} personas` : ''].filter(Boolean).join(' · '),
        link: ['/rehearsal', r.id],
      });
    }
    const g = pick(this.recentListings());
    if (g) {
      slides.push({
        key: 'g-' + g.id, kicker: 'En la tienda', title: g.title, tone: 'ink', cta: 'Ver anuncio',
        meta: [g.price ? `${g.price} €` : '', g.city].filter(Boolean).join(' · '), link: ['/shop', g.id],
      });
    }
    return shuffled(slides, rnd);
  });
  /** Solid poster block per slide tone (compact on every screen). */
  slideClass(tone: FeaturedSlide['tone']): string {
    switch (tone) {
      case 'red':    return 'bg-primary-500 text-white shadow-[4px_4px_0_0_#141210]';
      case 'yellow': return 'bg-poster-yellow text-ink shadow-[4px_4px_0_0_#141210]';
      default:       return 'bg-ink text-poster-paper shadow-[4px_4px_0_0_#c23a1f]';
    }
  }

  kickerClass(tone: FeaturedSlide['tone']): string {
    return tone === 'ink' ? 'text-poster-yellow' : '';
  }

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
      const venueCols      = 'id, user_id, name, city, avatar_url, capacity, created_at';
      const bandCols       = 'id, user_id, name, city, genre, avatar_url, created_at';
      const teacherCols    = 'id, user_id, name, city, instrument, avatar_url, created_at';
      const rehearsalCols  = 'id, user_id, name, city, avatar_url, capacity, hourly_rate, created_at';
      const postCols       = 'id, type, text, city, instrument, author_name, author_profile_type, author_profile_id, created_at'
        + (await this.features.has('postTitle') ? ', title' : '');
      await this.features.has('postGigDate');
      const listingCols    = 'id, title, price, condition, category, city, images, created_at';

      const db = this.supabase.client;
      const since = sinceISO(SE_BUSCA_MAX_DAYS);
      // Each list is asked twice in parallel — the user's city and all of Spain —
      // and merged city-first, so local content always leads and gaps get filled.
      // The user's city first; all of Spain only when the city alone cannot fill
      // `limit` rows. A failed list just stays empty; it never takes the home down.
      const both = async <T>(limit: number, build: (local: boolean) => PromiseLike<{ data: unknown }>): Promise<[T[], T[]]> => {
        const run = (local: boolean) => Promise.resolve(build(local)).then(r => (r.data ?? []) as T[], () => [] as T[]);
        const local = city ? await run(true) : [];
        return [local, local.length >= limit ? [] : await run(false)];
      };
      // `any`: Supabase's PostgrestFilterBuilder generics are too deep to thread through a helper.
      const inCity = (q: any, local: boolean) => local ? q.eq('city', city) : q; // eslint-disable-line @typescript-eslint/no-explicit-any

      const [musicians, events, venues, rehearsals, listings, posts, vacancies, bands, teachers] = await Promise.all([
        both<HomeMusician>(NEW_PEOPLE_LIMIT + 1, l => inCity(db.from('musicians').select(musicianCols), l).order('created_at', { ascending: false }).limit(12)),
        both<HomeEvent>(5, l => inCity(db.from('events').select(eventCols), l).gte('date', todayStr).order('date', { ascending: true }).limit(5)),
        both<HomeVenue>(5, l => inCity(db.from('venues').select(venueCols), l).order('created_at', { ascending: false }).limit(5)),
        both<HomeRehearsal>(5, l => inCity(db.from('rehearsal_spaces').select(rehearsalCols), l).order('created_at', { ascending: false }).limit(5)),
        both<HomeListing>(6, l => inCity(db.from('gear_listings').select(listingCols).eq('status', 'active'), l).order('created_at', { ascending: false }).limit(6)),
        this.seBuscaPostsQuery(postCols, city, since).then(r => r, () => ({ data: [] })),
        // Non-critical module: a failure just hides those rows.
        this.vacanciesSvc.listOpen({ city: city || null, since, limit: 6 }).catch(() => []),
        both<HomeBand>(NEW_PEOPLE_LIMIT, l => inCity(db.from('bands').select(bandCols), l).order('created_at', { ascending: false }).limit(NEW_PEOPLE_LIMIT)),
        both<HomeTeacher>(NEW_PEOPLE_LIMIT, l => inCity(db.from('teachers').select(teacherCols), l).order('created_at', { ascending: false }).limit(NEW_PEOPLE_LIMIT)),
      ]);

      // A newer load (e.g. for the profile's city) started meanwhile: drop this one.
      if (seq !== this.loadSeq) return;

      const people = cityFirst(musicians[0], musicians[1], NEW_PEOPLE_LIMIT + 1);
      this.recentMusicians.set(people);
      // "Ver todo" keeps the city filter unless the city itself has few musicians.
      this.musiciansNationwide.set(!!city && musicians[0].length < 6);
      this.seBuscaNationwide.set(false);
      this.recentEvents.set(cityFirst(events[0], events[1], 5));
      this.recentVenues.set(cityFirst(venues[0], venues[1], 5));
      this.recentBands.set(cityFirst(bands[0], bands[1], NEW_PEOPLE_LIMIT));
      this.recentTeachers.set(cityFirst(teachers[0], teachers[1], NEW_PEOPLE_LIMIT));
      this.recentRehearsals.set(cityFirst(rehearsals[0], rehearsals[1], 5));
      this.recentListings.set(cityFirst(listings[0], listings[1], 6));
      this.recentPosts.set((posts.data || []) as unknown as HomePost[]);
      this.recentVacancies.set(vacancies as unknown as HomeVacancy[]);

      if (city && !(posts.data?.length) && !vacancies.length) {
        // Nobody wants anything in the user's city yet: show all of Spain and say so.
        Promise.all([
          this.seBuscaPostsQuery(postCols, '', since),
          this.vacanciesSvc.listOpen({ since, limit: 6 }).catch(() => []),
        ]).then(([{ data: p }, v]) => {
          if (seq !== this.loadSeq) return;
          this.seBuscaNationwide.set(true);
          this.recentPosts.set((p || []) as unknown as HomePost[]);
          this.recentVacancies.set(v as unknown as HomeVacancy[]);
        }).catch((err: unknown) => { if (!environment.production) console.error('[Home] fallback failed:', err); });
      }
    } catch (err) {
      if (!environment.production) console.error('[Home] loadContent error:', err);
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Latest board posts (last three months), from one city or (empty city) all of Spain. */
  private seBuscaPostsQuery(cols: string, city: string, since: string) {
    let q = this.supabase.client.from('posts').select(cols).gte('created_at', since).order('created_at', { ascending: false }).limit(8);
    // One-gig asks leave the board once their date has passed.
    if (this.features.state('postGigDate')()) q = q.or(`gig_date.is.null,gig_date.gte.${localToday()}`);
    return city ? q.eq('city', city) : q;
  }

  /** Same lists for the profile's city, without bringing the skeletons back. */
  private reloadForCity() {
    this.loadError.set(false);
    void this.loadContent();
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
