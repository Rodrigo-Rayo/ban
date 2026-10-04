import { MediaFeaturesService } from '../../core/services/media-features.service';
import { publishErrorMessage } from '../../core/utils/publish-error';
import { Component, signal, inject, OnInit, DestroyRef, computed, ElementRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';
import { VacanciesService, OpenVacancy } from '../../core/services/vacancies.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { Post, PostType } from '../../core/models';
import { CITIES, CITIES_WITH_ALL } from '../../core/constants/cities';

const ALL_SPAIN = 'Toda España';

/**
 * The city "Se busca" opens on: the profile's city, else the last city the
 * user picked on the home (localStorage). Unknown values fall back to all of Spain.
 */
export function preferredFeedCity(profileCity: string | null | undefined, cachedCity: string | null | undefined): string | null {
  const known = (c: string | null | undefined) => !!c && c !== 'Otra' && (CITIES as readonly string[]).includes(c);
  if (known(profileCity)) return profileCity!;
  if (known(cachedCity)) return cachedCity!;
  return null;
}
import { GENRES, INSTRUMENTS } from '../../core/constants/music.constants';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ConfirmService } from '../../core/services/confirm.service';
import { timeAgo } from '../../core/utils/display.utils';
import { askLabel, askStampClass, POST_TYPE_OPTIONS, SE_BUSCA_MAX_DAYS, SE_BUSCA_PERIODS, sinceISO } from '../../core/utils/se-busca';

export type SeBuscaSection = 'todo' | 'bandas' | 'musicos' | 'otros';

/** "Se busca" sections; `types` = post types listed in each (null = all). */
export const SE_BUSCA_SECTIONS: readonly { id: SeBuscaSection; label: string; types: PostType[] | null }[] = [
  { id: 'todo',    label: 'Todo',                   types: null },
  { id: 'bandas',  label: 'Bandas buscan',          types: ['band_seeking_musician'] },
  { id: 'musicos', label: 'Músicos buscan',         types: ['musician_seeking_band'] },
  { id: 'otros',   label: 'Colaboraciones y otros', types: ['collab', 'session_offer', 'looking_for_rehearsal', 'event_announcement', 'gear_sale', 'other'] },
];
const VACANCY_LIMIT = 30;

/** One row of the merged "Se busca" list: a free-text post or a band vacancy. */
export type SeBuscaItem =
  | { kind: 'post'; id: string; created_at: string; post: Post }
  | { kind: 'vacancy'; id: string; created_at: string; vacancy: OpenVacancy };

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/**
 * Posts + vacancies in one list, newest first. A "banda busca músico" post that
 * repeats one of the band's open vacancies (same band, same instrument) is shown
 * once, as the vacancy (it links to the profile where musicians can apply).
 * While more posts can be loaded, vacancies older than the oldest loaded post wait
 * for the next page so the date order stays true.
 */
export function mergeSeBusca(posts: Post[], vacancies: OpenVacancy[], morePosts: boolean): SeBuscaItem[] {
  const covered = new Set(vacancies.flatMap(v => [
    `${v.bands.id}|${norm(v.instrument)}`, `${norm(v.bands.name)}|${norm(v.instrument)}`,
  ]));
  const isDuplicate = (p: Post) => p.type === 'band_seeking_musician' && (
    covered.has(`${p.author_profile_id}|${norm(p.instrument)}`) || covered.has(`${norm(p.author_name)}|${norm(p.instrument)}`));
  const oldestPost = posts.at(-1)?.created_at ?? '';
  const items: SeBuscaItem[] = [
    ...posts.filter(p => !isDuplicate(p)).map(p => ({ kind: 'post' as const, id: p.id, created_at: p.created_at, post: p })),
    ...vacancies
      .filter(v => !morePosts || v.created_at >= oldestPost)
      .map(v => ({ kind: 'vacancy' as const, id: v.id, created_at: v.created_at, vacancy: v })),
  ];
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

@Component({
    selector: 'app-feed',
    imports: [FormsModule, RouterLink, IconComponent],
    templateUrl: './feed.component.html'
})
export class FeedComponent implements OnInit {
  readonly timeAgo = timeAgo;

  private supabase = inject(SupabaseService);
  private vacanciesSvc = inject(VacanciesService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private location = inject(Location);
  private confirm = inject(ConfirmService);
  private features = inject(MediaFeaturesService);
  /** posts.title exists (supabase/2026_10_post_title.sql): new posts must have one. */
  readonly postTitleAvailable = this.features.state('postTitle');
  readonly MAX_TITLE_LENGTH = 60;
  private readonly sectionNav = viewChild<ElementRef<HTMLElement>>('sectionNav');

  posts = signal<Post[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  hasMore = signal(true);
  submitting = signal(false);
  showForm = signal(false);
  formOnly = signal(false);
  error = signal('');
  private readonly PAGE_SIZE = 20;
  readonly MAX_POST_LENGTH = 500;

  filterCity = signal('Toda España');
  filterInstrument = signal('');
  /** "Publicado" window in days; never more than SE_BUSCA_MAX_DAYS. */
  filterDays = signal(SE_BUSCA_MAX_DAYS);
  readonly periods = SE_BUSCA_PERIODS;
  /** Which "Se busca" section is shown (URL: ?ver=bandas|musicos|otros). */
  section = signal<SeBuscaSection>('todo');
  readonly sections = SE_BUSCA_SECTIONS;
  /** Open band vacancies, merged into "Todo" and "Bandas buscan". */
  vacancies = signal<OpenVacancy[]>([]);
  readonly showVacancies = computed(() => this.section() === 'todo' || this.section() === 'bandas');
  /** The single merged list rendered by the page. */
  readonly items = computed(() => mergeSeBusca(this.posts(), this.vacancies(), this.hasMore()));
  private initialised = false;

  currentUser = signal<User | null>(null);
  /** The first list has arrived: later reloads keep it on screen instead of showing the skeleton. */
  readonly loadedOnce = signal(false);
  userProfile = signal<{ id: string; name: string; city: string; avatar_url: string | null; type: string } | null>(null);

  newPost = {
    type: 'musician_seeking_band' as PostType,
    title: '',
    text: '',
    city: 'Madrid',
    instrument: '',
    genre: '',
  };

  readonly cities = CITIES_WITH_ALL;
  readonly instruments = INSTRUMENTS;
  readonly genres = GENRES;

  readonly postTypes = POST_TYPE_OPTIONS;

  onInstrumentChange(val: string) {
    this.filterInstrument.set(val);
    this.loadPosts();
  }

  hasActiveFilters(): boolean {
    return this.filterCity() !== 'Toda España' || !!this.filterInstrument() || this.filterDays() !== SE_BUSCA_MAX_DAYS;
  }

  /** Only the city narrows the list (no instrument): the empty state offers all of Spain. */
  readonly onlyCityFilter = computed(() => this.filterCity() !== ALL_SPAIN && !this.filterInstrument() && this.filterDays() === SE_BUSCA_MAX_DAYS);

  onPeriodChange(days: number | string) {
    this.filterDays.set(Number(days) || SE_BUSCA_MAX_DAYS);
    this.loadPosts();
  }

  showAllSpain() {
    this.filterCity.set(ALL_SPAIN);
    this.loadPosts();
  }

  clearFilters() {
    this.filterCity.set('Toda España');
    this.filterInstrument.set('');
    this.filterDays.set(SE_BUSCA_MAX_DAYS);
    this.loadPosts();
  }

  /** Bands look for musicians; everyone else looks for a band. */
  private defaultPostType(): PostType {
    return this.userProfile()?.type === 'band' ? 'band_seeking_musician' : 'musician_seeking_band';
  }

  /** Keeps the active section tab visible when the tab strip is scrolled. */
  private revealActiveSection() {
    setTimeout(() => {
      const nav = this.sectionNav()?.nativeElement;
      const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      // Scroll the strip itself: scrollIntoView would move the sequential-focus start point past the skip link.
      if (nav && el) nav.scrollLeft += el.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - el.offsetWidth) / 2;
    }, 0);
  }

  /** Switches section through the URL so it is shareable and survives reloads. */
  setSection(id: SeBuscaSection) {
    this.router.navigate([], { queryParams: { ver: id === 'todo' ? null : id }, queryParamsHandling: 'merge' });
  }

  async ngOnInit() {
    this.seo.set({ title: 'Se busca', description: 'Bandas que buscan músicos, músicos que buscan banda y colaboraciones en toda España. Publica gratis tu anuncio.' });
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      this.currentUser.set(user);

      // React to ?new=1 on every navigation, not only on first load: the "Publicar"
      // links target /feed?new=1 and are often clicked while already on /feed.
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
        const ver = params.get('ver');
        const next: SeBuscaSection = SE_BUSCA_SECTIONS.some(s => s.id === ver) ? ver as SeBuscaSection : 'todo';
        if (next !== this.section()) {
          this.section.set(next);
          if (this.initialised) this.loadPosts();
          this.revealActiveSection();
        }
        if (params.get('new') !== '1') return;
        if (!this.currentUser()) { this.router.navigate(['/auth/login']); return; }
        this.showForm.set(true);
        this.formOnly.set(true);
        // Drop the flag so a refresh after posting does not reopen the form.
        this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });

      if (user) {
        await this.auth.loadUserProfile(user.id);
        const profile = this.auth.userProfileData();
        if (profile) {
          this.userProfile.set({ ...profile, type: this.auth.userProfileType() });
          this.newPost.type = this.defaultPostType();
        }
        // Open on the user's own city, not all of Spain.
        let cached: string | null = null;
        try { cached = localStorage.getItem('bandyou_city'); } catch {}
        const city = preferredFeedCity(profile?.city, cached);
        if (city) {
          this.filterCity.set(city);
          this.newPost.city = city;
        }
      }
    } catch {
      // Auth errors are non-fatal — continue to load posts for anonymous view
    }

    this.initialised = true;
    if (!this.formOnly()) await this.loadPosts();
    this.revealActiveSection();
  }

  /** Post types of the current section, or null for every type. */
  private sectionTypes(): PostType[] | null {
    return SE_BUSCA_SECTIONS.find(s => s.id === this.section())?.types ?? null;
  }

  /** Bumped on every new list request: a slower, older response must not overwrite a newer one. */
  private listSeq = 0;
  /** Lower bound used by the current list, reused by "load more" so the window does not drift. */
  private listSince = '';

  private async loadVacancies(seq: number) {
    if (!this.showVacancies()) { this.vacancies.set([]); return; }
    try {
      const rows = await this.vacanciesSvc.listOpen({
        city: this.filterCity() !== 'Toda España' ? this.filterCity() : null,
        instrument: this.filterInstrument() || null,
        since: this.listSince,
        limit: VACANCY_LIMIT,
      });
      if (seq === this.listSeq) this.vacancies.set(rows);
    } catch {
      if (seq === this.listSeq) this.vacancies.set([]); // non-critical: the posts still load
    }
  }

  private static readonly POST_COLS = 'id,user_id,type,text,city,instrument,genre,author_name,author_profile_type,author_profile_id,created_at';

  /** Post columns, plus `title` once the column exists. */
  private async postCols(): Promise<string> {
    return FeedComponent.POST_COLS + (await this.features.has('postTitle') ? ',title' : '');
  }

  async loadPosts() {
    const seq = ++this.listSeq;
    this.listSince = sinceISO(this.filterDays());
    this.loading.set(true);
    this.loadingMore.set(false);
    this.hasMore.set(true);
    const vacanciesDone = this.loadVacancies(seq);
    try {
      let q = this.supabase.client.from('posts').select(await this.postCols())
        .gte('created_at', this.listSince)
        .order('created_at', { ascending: false });
      if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
      const types = this.sectionTypes();
      if (types) q = q.in('type', types);
      if (this.filterInstrument()) q = q.ilike('instrument', `%${this.filterInstrument()}%`);
      const { data, error } = await q.limit(this.PAGE_SIZE);
      if (seq !== this.listSeq) return; // filters changed meanwhile
      if (error) { this.error.set('No se pudieron cargar los anuncios. Inténtalo de nuevo.'); }
      else {
        this.posts.set((data || []) as unknown as Post[]);
        this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
      }
      await vacanciesDone;
    } finally {
      if (seq === this.listSeq) { this.loading.set(false); this.loadedOnce.set(true); }
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const seq = this.listSeq;
    try {
      const last = this.posts().at(-1);
      let q = this.supabase.client.from('posts').select(await this.postCols())
        .order('created_at', { ascending: false })
        .lt('created_at', last?.created_at ?? new Date().toISOString())
        .gte('created_at', this.listSince || sinceISO(this.filterDays()));
      if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
      const types = this.sectionTypes();
      if (types) q = q.in('type', types);
      if (this.filterInstrument()) q = q.ilike('instrument', `%${this.filterInstrument()}%`);
      const { data, error } = await q.limit(this.PAGE_SIZE);
      if (seq !== this.listSeq) return; // a new list replaced this one
      if (error) { this.toast.error('No se pudieron cargar más anuncios.'); return; }
      this.posts.update(p => [...p, ...((data || []) as unknown as Post[])]);
      this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    } finally {
      if (seq === this.listSeq) this.loadingMore.set(false);
    }
  }

  async submitPost() {
    if (!this.canPublish()) return;
    const user = this.currentUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }

    this.submitting.set(true);
    this.error.set('');

    try {
      const profile = this.userProfile();
      const { error } = await this.supabase.client.from('posts').insert({
        user_id: user.id,
        type: this.newPost.type,
        ...(this.postTitleAvailable() ? { title: this.newPost.title.trim() } : {}),
        text: this.newPost.text.trim(),
        city: this.newPost.city,
        instrument: this.newPost.instrument,
        genre: this.newPost.genre,
        // Never fall back to the email: listeners have their name in profiles (via RPC).
        author_name: profile?.name ?? ((await this.supabase.client.rpc('get_profile_name', { p_user_id: user.id })).data as string | null) ?? 'Usuario',
        author_profile_type: profile?.type ?? null,
        author_profile_id: profile?.id ?? null,
      });

      if (error) {
        this.toast.error(publishErrorMessage(error, 'No se pudo publicar. Intenta de nuevo.'));
        return;
      }
      this.newPost = { type: this.defaultPostType(), title: '', text: '', city: 'Madrid', instrument: '', genre: '' };
      this.showForm.set(false);
      this.formOnly.set(false);
      this.toast.success('Anuncio publicado.');
      await this.loadPosts();
    } finally {
      this.submitting.set(false);
    }
  }

  cancelOrToggleForm() {
    if (this.formOnly()) {
      this.location.back();
    } else {
      this.showForm.set(!this.showForm());
    }
  }

  async deletePost(id: string) {
    const user = this.currentUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }
    const ok = await this.confirm.ask({
      title: '¿Eliminar este anuncio?',
      message: 'Dejará de aparecer en Se busca.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      const { error } = await this.supabase.client.from('posts').delete().eq('id', id).eq('user_id', user.id);
      if (error) { this.toast.error('No se pudo eliminar.'); return; }
      this.posts.update(list => list.filter(p => p.id !== id));
      this.toast.success('Anuncio eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el anuncio.');
    }
  }

  /** What the row asks for ("Busca banda", "Busca guitarra"…) and its stamp: yellow = busca, ink = ofrece. */
  askLabel(item: SeBuscaItem): string {
    return item.kind === 'vacancy' ? askLabel('vacancy', item.vacancy.instrument) : askLabel(item.post.type, item.post.instrument);
  }

  askStamp(item: SeBuscaItem): string {
    return askStampClass(item.kind === 'vacancy' ? 'vacancy' : item.post.type);
  }

  /** Text, and a title when titles exist, within their limits. */
  canPublish(): boolean {
    const text = this.newPost.text.trim();
    if (!text || text.length > this.MAX_POST_LENGTH) return false;
    if (!this.postTitleAvailable()) return true;
    const title = this.newPost.title.trim();
    return !!title && title.length <= this.MAX_TITLE_LENGTH;
  }

  /** Who is asking: the band, or the post's author. */
  whoLabel(item: SeBuscaItem): string {
    return item.kind === 'vacancy' ? item.vacancy.bands.name : (item.post.author_name || 'Usuario');
  }

  /** Card headline: the post's title, or (older posts, vacancies) who is asking. */
  headline(item: SeBuscaItem): string {
    return item.kind === 'post' && item.post.title?.trim() ? item.post.title.trim() : this.whoLabel(item);
  }

  /** One quiet line: instrument (when not already in the stamp) · genre · city. */
  metaLine(item: SeBuscaItem): string {
    if (item.kind === 'vacancy') {
      const v = item.vacancy;
      return [v.genre || v.bands.genre, v.bands.city].filter(Boolean).join(' · ');
    }
    const p = item.post;
    const instrumentInStamp = p.type === 'band_seeking_musician' && !!p.instrument;
    // With a title as headline, the author moves to this line.
    const author = p.title?.trim() ? (p.author_name || 'Usuario') : null;
    return [author, instrumentInStamp ? null : p.instrument, p.genre, p.city].filter(Boolean).join(' · ');
  }

  detailText(item: SeBuscaItem): string | null {
    return item.kind === 'vacancy' ? item.vacancy.description : item.post.text;
  }

  profileRoute(p: Post): string[] | null {
    if (!p.author_profile_id || !p.author_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[p.author_profile_type];
    return seg ? [`/${seg}`, p.author_profile_id] : null;
  }
}

