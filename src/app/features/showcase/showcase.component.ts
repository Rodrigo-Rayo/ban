import { Component, ElementRef, HostListener, OnDestroy, OnInit, effect, inject, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { MessagesService } from '../../core/services/messages.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { ListenPlayerComponent } from '../../shared/components/listen-player/listen-player.component';
import { PublishSheetComponent } from '../../shared/components/publish-sheet/publish-sheet.component';
import { avatarColor } from '../../core/utils/display.utils';
import { localToday } from '../../core/utils/date';
import { SE_BUSCA_MAX_DAYS, sinceISO } from '../../core/utils/se-busca';
import { initialOf } from '../inbox/profile-avatar';
import {
  BandRow, EventRow, GearRow, MusicianRow, PlaceRow, PostRow, ShowcaseCard, TeacherRow,
  bandCard, canPlay, eventCard, gearCard, musicianCard, postCard, rehearsalCard, showcaseOrder, startAt, teacherCard, venueCard,
} from './showcase';

/** Rows per list: plenty for a visit, cheap for the database (one request each, only when opened). */
const PER_LIST = 30;

/**
 * El Escaparate: the whole scene (profiles, gigs, Se busca, shop) as full-screen
 * cards swiped sideways like stories, in a fresh order on every visit. Only the
 * card on screen holds a player, which starts by itself where the browser allows
 * it (it may still ask for a tap: iPhone, Spotify); moving on stops it.
 */
@Component({
  selector: 'app-showcase',
  imports: [RouterLink, ListenPlayerComponent, PublishSheetComponent],
  template: `
    <div class="fixed inset-0 z-[70] bg-ink text-poster-paper" role="dialog" aria-modal="true" aria-label="Escaparate">
      <!-- Top bar -->
      <div class="absolute top-1 inset-x-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-ink/80 to-transparent pointer-events-none">
        <p class="font-display text-2xl uppercase leading-none">Escapa<span class="text-primary-500">rate</span></p>
        <div class="flex items-center gap-2 pointer-events-auto">
          @if (cards().length) {
            <span class="font-mono text-xs font-bold mr-1" aria-live="polite">{{ active() + 1 }} / {{ cards().length }}</span>
          }
          <button type="button" (click)="publishOpen.set(true)" class="w-11 h-11 flex items-center justify-center bg-primary-500 border-2 border-poster-paper text-white hover:bg-primary-600 transition-colors"
                  aria-label="Publicar" aria-haspopup="dialog" [attr.aria-expanded]="publishOpen()">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button type="button" (click)="close()" class="w-11 h-11 flex items-center justify-center border-2 border-poster-paper bg-ink/40 hover:bg-poster-paper hover:text-ink transition-colors" aria-label="Cerrar el escaparate">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="h-full flex items-center justify-center font-mono text-xs uppercase tracking-wide" role="status">Cargando la escena…</div>
      } @else if (!cards().length) {
        <div class="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p class="font-display text-3xl uppercase">Aún no hay nada aquí</p>
          <button type="button" (click)="close()" class="btn-primary min-h-[44px] px-6">Volver</button>
        </div>
      } @else {
        <!-- Progress, like stories -->
        <div class="absolute top-0 inset-x-0 z-20 h-1 bg-poster-paper/20" aria-hidden="true">
          <div class="h-full bg-poster-yellow transition-[width] duration-300" [style.width.%]="(active() + 1) / cards().length * 100"></div>
        </div>
        <div class="h-full sm:max-w-[30rem] mx-auto sm:border-x-2 sm:border-poster-paper/20">
          <div #scroller class="h-full flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar" tabindex="-1">
            @for (c of cards(); track c.key; let i = $index) {
              <article #card [attr.data-i]="i" class="relative shrink-0 w-full h-full snap-center snap-always overflow-hidden"
                       [class.bg-poster-yellow]="c.look === 'ask'" [class.text-ink]="c.look === 'ask'" [attr.aria-label]="c.title">

                <!-- Background -->
                @if (c.look === 'ask') {
                  <div class="absolute inset-0 bg-[repeating-linear-gradient(-58deg,transparent_0_46px,rgba(20,18,16,.06)_46px_50px)]" aria-hidden="true"></div>
                  <p class="absolute top-24 left-5 font-display text-[5.5rem] leading-[0.85] uppercase -rotate-3 opacity-90" aria-hidden="true">Se<br>busca</p>
                } @else if (c.image) {
                  <img [src]="c.image" alt="" class="absolute inset-0 w-full h-full object-cover" [class.object-top]="c.look === 'gig'"
                       [attr.loading]="i < 2 ? 'eager' : 'lazy'" decoding="async"/>
                  <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden="true"></div>
                } @else if (c.look === 'gig' && c.date) {
                  <div class="absolute inset-0 bg-primary-500 flex flex-col items-center justify-center pb-40 text-poster-paper" aria-hidden="true">
                    <span class="font-mono text-lg font-bold uppercase tracking-[0.3em]">{{ c.date.weekday }}</span>
                    <span class="font-display text-[11rem] leading-none">{{ c.date.day }}</span>
                    <span class="font-display text-5xl uppercase leading-none">{{ c.date.month }}</span>
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" aria-hidden="true"></div>
                } @else {
                  <div class="absolute inset-0 flex items-center justify-center pb-32" [style.background]="color(c.title)" aria-hidden="true">
                    <span class="font-display text-[14rem] leading-none text-poster-paper/90 uppercase">{{ initial(c.title) }}</span>
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" aria-hidden="true"></div>
                }

                <!-- Tap the left / right side to go back / on, like stories -->
                <button type="button" tabindex="-1" (click)="step(-1)" class="absolute left-0 top-16 bottom-[45%] w-1/3" aria-label="Anterior"></button>
                <button type="button" tabindex="-1" (click)="step(1)" class="absolute right-0 top-16 bottom-[45%] w-2/3" aria-label="Siguiente"></button>

                <!-- What it is -->
                <div class="absolute inset-x-0 bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
                  <p class="font-mono text-[11px] font-bold uppercase tracking-wide" [class.text-poster-yellow]="c.look !== 'ask'">{{ c.kicker }}</p>
                  <h2 class="font-display uppercase leading-[0.95] [overflow-wrap:anywhere]"
                      [class.text-5xl]="c.title.length <= 28" [class.text-4xl]="c.title.length > 28">{{ c.title }}</h2>
                  @if (c.subtitle) {
                    <p class="text-sm -mt-1" [class.opacity-80]="c.look !== 'ask'">{{ c.subtitle }}</p>
                  }
                  @if (c.body) {
                    <p class="text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] line-clamp-5">{{ c.body }}</p>
                  }
                  @if (c.stamp && c.look !== 'ask') {
                    <p class="self-start bg-poster-yellow text-ink border-2 border-ink font-mono text-xs font-bold uppercase tracking-wide px-3 py-1.5 -rotate-1">{{ c.stamp }}</p>
                  }

                  @if (playable(c)) {
                    <!-- Only the card on screen holds a player, and it starts by itself: moving on stops it -->
                    @if (i === active()) {
                      <app-listen-player [links]="c.links" [who]="''" [autoplay]="true"/>
                    }
                  } @else if (c.kind === 'musician' || c.kind === 'band') {
                    <p class="font-mono text-[11px] uppercase tracking-wide opacity-60">Aún no ha subido su tema</p>
                  }

                  <div class="grid gap-2" [class.grid-cols-2]="!!c.contactUserId">
                    @if (c.look === 'ask') {
                      <a [routerLink]="c.route" class="min-h-[48px] flex items-center justify-center border-2 border-ink font-mono text-xs font-bold uppercase tracking-wide hover:bg-ink hover:text-poster-paper transition-colors">{{ c.routeLabel }}</a>
                    } @else {
                      <a [routerLink]="c.route" class="min-h-[48px] flex items-center justify-center border-2 border-poster-paper font-mono text-xs font-bold uppercase tracking-wide hover:bg-poster-paper hover:text-ink transition-colors">{{ c.routeLabel }}</a>
                    }
                    @if (c.contactUserId) {
                      <button type="button" (click)="write(c)" [disabled]="contacting()"
                        class="btn-primary min-h-[48px] disabled:opacity-60">{{ contacting() ? 'Abriendo…' : 'Escribir' }}</button>
                    }
                  </div>
                  @if (i === 0 && cards().length > 1) {
                    <p class="text-center font-mono text-[11px] uppercase tracking-wide opacity-60" aria-hidden="true">Desliza o toca para ver más →</p>
                  }
                </div>
              </article>
            }
          </div>
        </div>
        <!-- Desktop: previous / next beside the column -->
        <button type="button" (click)="step(-1)" [disabled]="active() === 0"
          class="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-[calc(50%-19rem)] w-11 h-11 items-center justify-center border-2 border-poster-paper hover:bg-poster-paper hover:text-ink disabled:opacity-30 transition-colors" aria-label="Anterior">◀</button>
        <button type="button" (click)="step(1)" [disabled]="active() === cards().length - 1"
          class="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-[calc(50%+16.25rem)] w-11 h-11 items-center justify-center border-2 border-poster-paper hover:bg-poster-paper hover:text-ink disabled:opacity-30 transition-colors" aria-label="Siguiente">▶</button>
      }

      <!-- "+": publish from here too -->
      <app-publish-sheet [(open)]="publishOpen"/>
    </div>
  `,
})
export class ShowcaseComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  readonly auth = inject(AuthService);
  private messages = inject(MessagesService);
  private features = inject(MediaFeaturesService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  readonly loading = signal(true);
  readonly cards = signal<ShowcaseCard[]>([]);
  readonly active = signal(0);
  readonly contacting = signal(false);
  readonly publishOpen = signal(false);

  private readonly cardEls = viewChildren<ElementRef<HTMLElement>>('card');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private observer: IntersectionObserver | null = null;
  private observed = new Set<HTMLElement>();
  private previousOverflow = '';

  constructor() {
    // Cards arrive after the data loads: watch each one to know which is on screen.
    effect(() => {
      const els = this.cardEls();
      untracked(() => this.observeCards(els));
    });
  }

  ngOnInit() {
    this.seo.set({
      title: 'Escaparate',
      description: 'Músicos, bandas, conciertos y anuncios de la escena, en pantalla completa.',
      url: 'https://www.bandyou.es/escaparate',
    });
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void this.load();
  }

  ngOnDestroy() {
    document.body.style.overflow = this.previousOverflow;
    this.observer?.disconnect();
  }

  private observeCards(els: readonly ElementRef<HTMLElement>[]) {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer ??= new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) this.active.set(Number((e.target as HTMLElement).dataset['i'] ?? 0));
      }
    }, { threshold: 0.6 });
    for (const ref of els) {
      const el = ref.nativeElement;
      if (!this.observed.has(el)) { this.observed.add(el); this.observer.observe(el); }
    }
  }

  private async load() {
    const db = this.supabase.client;
    const [hasDemo, hasImage, hasTitle, hasGigDate] = await Promise.all([
      this.features.has('demoUrl'), this.features.has('eventImage'), this.features.has('postTitle'), this.features.has('postGigDate'),
    ]);
    const media = 'spotify_url, soundcloud_url, youtube_url' + (hasDemo ? ', demo_url' : '');
    const today = localToday();
    // A failed list just leaves its cards out; it never empties the showcase.
    const rows = <T>(q: PromiseLike<{ data: unknown }>): Promise<T[]> =>
      Promise.resolve(q).then(r => (r.data ?? []) as T[], () => [] as T[]);
    const newest = (table: string, cols: string) =>
      db.from(table).select(cols).order('created_at', { ascending: false }).limit(PER_LIST);
    let posts = db.from('posts').select('id, user_id, type, text, city, instrument, author_name, created_at' + (hasTitle ? ', title' : ''))
      .gte('created_at', sinceISO(SE_BUSCA_MAX_DAYS)).order('created_at', { ascending: false }).limit(PER_LIST);
    if (hasGigDate) posts = posts.or(`gig_date.is.null,gig_date.gte.${today}`);

    const [musicians, bands, venues, teachers, rehearsals, events, asks, gear] = await Promise.all([
      rows<MusicianRow>(newest('musicians', `id, user_id, name, instrument, genre, city, avatar_url, created_at, ${media}`)),
      rows<BandRow>(newest('bands', `id, user_id, name, genre, city, avatar_url, looking_for, created_at, ${media}`)),
      rows<PlaceRow>(newest('venues', 'id, user_id, name, city, avatar_url, created_at')),
      rows<TeacherRow>(newest('teachers', 'id, user_id, name, city, instrument, avatar_url, created_at')),
      rows<PlaceRow>(newest('rehearsal_spaces', 'id, user_id, name, city, avatar_url, created_at')),
      rows<EventRow>(db.from('events').select('id, user_id, title, venue, city, date, time, genre, created_at' + (hasImage ? ', image_url' : ''))
        .gte('date', today).order('date', { ascending: true }).limit(PER_LIST)),
      rows<PostRow>(posts),
      rows<GearRow>(db.from('gear_listings').select('id, user_id, title, price, city, images, created_at').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(PER_LIST)),
    ]);
    const all = [
      ...musicians.map(musicianCard), ...bands.map(bandCard), ...venues.map(venueCard), ...teachers.map(teacherCard),
      ...rehearsals.map(rehearsalCard), ...events.map(eventCard), ...asks.map(postCard), ...gear.map(gearCard),
    ];
    let city = '';
    try { city = localStorage.getItem('bandyou_city') || ''; } catch { /* private mode */ }
    const ordered = showcaseOrder(all, city, this.auth.user()?.id ?? null);
    // ?p=<key>: start at what was tapped on the home.
    this.cards.set(startAt(ordered, this.route.snapshot.queryParamMap.get('p')));
    this.loading.set(false);
  }

  playable(c: ShowcaseCard): boolean { return canPlay(c); }
  initial(name: string): string { return initialOf(name); }
  color(name: string): string { return avatarColor(name); }

  async write(c: ShowcaseCard) {
    if (!this.auth.isLoggedIn()) { void this.router.navigate(['/auth/login']); return; }
    if (this.contacting() || !c.contactUserId) return;
    this.contacting.set(true);
    const result = await this.messages.getOrCreateConversation(c.contactUserId, c.title);
    this.contacting.set(false);
    if (!result || 'error' in result) { this.toast.error(result && 'error' in result ? result.error : 'No se pudo abrir el chat.'); return; }
    void this.router.navigate(['/inbox', result.id]);
  }

  /** One card back (-1) or on (+1). */
  step(delta: number) {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollBy({ left: delta * el.clientWidth, behavior: 'smooth' });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.publishOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.step(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.step(-1); }
  }

  @HostListener('document:keydown.escape')
  close() {
    if (this.publishOpen()) { this.publishOpen.set(false); return; }
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/home']);
  }
}
