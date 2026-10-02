import { Component, signal, inject, OnInit, OnDestroy, DestroyRef, computed } from '@angular/core';
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
import { CITIES_WITH_ALL } from '../../core/constants/cities';
import { GENRES, INSTRUMENTS } from '../../core/constants/music.constants';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { avatarColor, timeAgo } from '../../core/utils/display.utils';

export type SeBuscaSection = 'todo' | 'bandas' | 'musicos' | 'otros';

/** "Se busca" sections; `types` = post types listed in each (null = all). */
export const SE_BUSCA_SECTIONS: readonly { id: SeBuscaSection; label: string; types: PostType[] | null }[] = [
  { id: 'todo',    label: 'Todo',                   types: null },
  { id: 'bandas',  label: 'Bandas buscan',          types: ['band_seeking_musician'] },
  { id: 'musicos', label: 'Músicos buscan',         types: ['musician_seeking_band'] },
  { id: 'otros',   label: 'Colaboraciones y otros', types: ['collab', 'session_offer', 'looking_for_rehearsal', 'event_announcement', 'gear_sale', 'other'] },
];
const VACANCY_PREVIEW = 3;
const VACANCY_PAGE = 30;

@Component({
    selector: 'app-feed',
    imports: [FormsModule, RouterLink, IconComponent],
    templateUrl: './feed.component.html'
})
export class FeedComponent implements OnInit, OnDestroy {
  readonly avatarColor = avatarColor;
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
  private instrumentTimeout: ReturnType<typeof setTimeout> | undefined;

  filterCity = signal('Toda España');
  filterInstrument = signal('');
  /** Which "Se busca" section is shown (URL: ?ver=bandas|musicos|otros). */
  section = signal<SeBuscaSection>('todo');
  readonly sections = SE_BUSCA_SECTIONS;
  /** Open band vacancies, shown in "Todo" (preview) and "Bandas buscan" (full list). */
  vacancies = signal<OpenVacancy[]>([]);
  readonly showVacancies = computed(() => this.section() === 'todo' || this.section() === 'bandas');
  private initialised = false;

  currentUser = signal<User | null>(null);
  userProfile = signal<{ id: string; name: string; city: string; avatar_url: string | null; type: string } | null>(null);

  newPost = {
    type: 'musician_seeking_band' as PostType,
    text: '',
    city: 'Madrid',
    instrument: '',
    genre: '',
  };

  readonly cities = CITIES_WITH_ALL;
  readonly instruments = INSTRUMENTS;
  readonly genres = GENRES;

  readonly postTypes: { id: PostType; label: string; emoji: string; icon: string }[] = [
    { id: 'musician_seeking_band',  label: 'Músico busca banda',    emoji: '🎸', icon: 'music'          },
    { id: 'band_seeking_musician',  label: 'Banda busca músico',    emoji: '🥁', icon: 'mic'            },
    { id: 'session_offer',          label: 'Ofrezco sesión',        emoji: '🎙️', icon: 'mic'            },
    { id: 'looking_for_rehearsal',  label: 'Busco local ensayo',    emoji: '🏠', icon: 'headphones'     },
    { id: 'collab',                 label: 'Busco colaboración',    emoji: '🤝', icon: 'users'          },
    { id: 'other',                  label: 'Otro',                  emoji: '📢', icon: 'newspaper'      },
  ];

  onInstrumentChange(val: string) {
    this.filterInstrument.set(val);
    clearTimeout(this.instrumentTimeout);
    this.instrumentTimeout = setTimeout(() => this.loadPosts(), 400);
  }

  hasActiveFilters(): boolean {
    return this.filterCity() !== 'Toda España' || !!this.filterInstrument();
  }

  clearFilters() {
    this.filterCity.set('Toda España');
    this.filterInstrument.set('');
    this.loadPosts();
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
        }
      }
    } catch {
      // Auth errors are non-fatal — continue to load posts for anonymous view
    }

    this.initialised = true;
    if (!this.formOnly()) await this.loadPosts();
  }

  /** Post types of the current section, or null for every type. */
  private sectionTypes(): PostType[] | null {
    return SE_BUSCA_SECTIONS.find(s => s.id === this.section())?.types ?? null;
  }

  private async loadVacancies() {
    if (!this.showVacancies()) { this.vacancies.set([]); return; }
    try {
      this.vacancies.set(await this.vacanciesSvc.listOpen({
        city: this.filterCity() !== 'Toda España' ? this.filterCity() : null,
        instrument: this.filterInstrument() || null,
        limit: this.section() === 'todo' ? VACANCY_PREVIEW : VACANCY_PAGE,
      }));
    } catch {
      this.vacancies.set([]); // non-critical: the posts still load
    }
  }

  private static readonly POST_COLS = 'id,user_id,type,text,city,instrument,genre,author_name,author_profile_type,author_profile_id,created_at';

  async loadPosts() {
    this.loading.set(true);
    this.hasMore.set(true);
    const vacanciesDone = this.loadVacancies();
    try {
      let q = this.supabase.client.from('posts').select(FeedComponent.POST_COLS).order('created_at', { ascending: false });
      if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
      const types = this.sectionTypes();
      if (types) q = q.in('type', types);
      if (this.filterInstrument()) q = q.ilike('instrument', `%${this.filterInstrument()}%`);
      const { data, error } = await q.limit(this.PAGE_SIZE);
      if (error) { this.error.set('No se pudieron cargar los anuncios. Inténtalo de nuevo.'); }
      else {
        this.posts.set(data || []);
        this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
      }
      await vacanciesDone;
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    clearTimeout(this.instrumentTimeout);
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      const last = this.posts().at(-1);
      let q = this.supabase.client.from('posts').select(FeedComponent.POST_COLS)
        .order('created_at', { ascending: false })
        .lt('created_at', last?.created_at ?? new Date().toISOString());
      if (this.filterCity() !== 'Toda España') q = q.eq('city', this.filterCity());
      const types = this.sectionTypes();
      if (types) q = q.in('type', types);
      if (this.filterInstrument()) q = q.ilike('instrument', `%${this.filterInstrument()}%`);
      const { data, error } = await q.limit(this.PAGE_SIZE);
      if (error) { this.toast.error('No se pudieron cargar más anuncios.'); return; }
      this.posts.update(p => [...p, ...(data || [])]);
      this.hasMore.set((data?.length ?? 0) === this.PAGE_SIZE);
    } finally {
      this.loadingMore.set(false);
    }
  }

  async submitPost() {
    if (!this.newPost.text.trim()) return;
    if (this.newPost.text.trim().length > this.MAX_POST_LENGTH) return;
    const user = this.currentUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }

    this.submitting.set(true);
    this.error.set('');

    try {
      const profile = this.userProfile();
      const { error } = await this.supabase.client.from('posts').insert({
        user_id: user.id,
        type: this.newPost.type,
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
        this.toast.error('No se pudo publicar. Intenta de nuevo.');
        return;
      }
      this.newPost = { type: 'musician_seeking_band', text: '', city: 'Madrid', instrument: '', genre: '' };
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
    if (!confirm('¿Eliminar este anuncio?')) return;
    try {
      const { error } = await this.supabase.client.from('posts').delete().eq('id', id).eq('user_id', user.id);
      if (error) { this.toast.error('No se pudo eliminar.'); return; }
      this.posts.update(list => list.filter(p => p.id !== id));
      this.toast.success('Anuncio eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el anuncio.');
    }
  }

  private readonly postTypeMap = new Map(this.postTypes.map(t => [t.id, t]));

  typeLabel(type: PostType) { return this.postTypeMap.get(type)?.label ?? type; }
  typeEmoji(type: PostType) { return this.postTypeMap.get(type)?.emoji ?? '📢'; }
  /** Poster stamp per post type. */
  typeStamp(type: PostType): string {
    const map: Record<string, string> = {
      musician_seeking_band: 'tag-accent',
      band_seeking_musician: 'tag-red',
      event_announcement: 'tag !bg-night !text-poster-paper',
      session_offer: 'tag-green',
      looking_for_rehearsal: 'tag',
      collab: 'tag !bg-primary-900',
    };
    return map[type] ?? 'tag';
  }

  typeIcon(type: PostType)  { return this.postTypeMap.get(type)?.icon ?? 'newspaper'; }

  profileRoute(p: Post): string[] | null {
    if (!p.author_profile_id || !p.author_profile_type) return null;
    const map: Record<string, string> = {
      musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal',
    };
    const seg = map[p.author_profile_type];
    return seg ? [`/${seg}`, p.author_profile_id] : null;
  }

  isRecent(post: Post): boolean {
    return Date.now() - new Date(post.created_at).getTime() < 86400000;
  }

}

