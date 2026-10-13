import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { MessagesService } from '../../core/services/messages.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { FavoritesService } from '../../core/services/favorites.service';
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
  bandCard, canPlay, cardSeconds, eventCard, favoriteId, favoriteType, gearCard, markSeen, musicianCard, postCard,
  progressWindow, rehearsalCard, shortAgo, showcaseOrder, startAt, teacherCard, venueCard,
} from './showcase';

/** Rows per list: plenty for a visit, cheap for the database (one request each, only when opened). */
const PER_LIST = 30;
/** Press this long on the picture to pause (shorter is a tap: next / previous). */
const HOLD_MS = 220;
/** Swipe down this far to close, like stories. */
const CLOSE_SWIPE_PX = 90;

/**
 * El Escaparate: the whole scene (profiles, gigs, Se busca, shop) as stories.
 * Cards move on by themselves (a bar fills at the top), tap the sides to go
 * back / on, hold to pause, swipe sideways or down to close. Only the card on
 * screen holds a player, which starts by itself where the browser allows it
 * (iPhone and Spotify may still ask for a tap); moving on stops it.
 */
@Component({
  selector: 'app-showcase',
  imports: [RouterLink, ListenPlayerComponent, PublishSheetComponent],
  template: `
    <div class="fixed inset-0 z-[70] bg-[#0b0a09] text-white select-none" role="dialog" aria-modal="true" aria-label="Escaparate"
         (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
      @if (loading()) {
        <div class="h-full flex flex-col items-center justify-center gap-4" role="status">
          <span class="w-10 h-10 story-ring border-[3px] border-white/20 border-t-poster-yellow animate-spin"></span>
          <span class="font-mono text-[11px] uppercase tracking-wide text-white/60">Cargando la escena…</span>
        </div>
      } @else if (!cards().length) {
        <div class="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p class="font-display text-3xl uppercase">Aún no hay nada aquí</p>
          <button type="button" (click)="close()" class="btn-primary min-h-[44px] px-6">Volver</button>
        </div>
      } @else {
        <div class="relative h-full sm:py-4 sm:max-w-[26rem] mx-auto">
          <div class="relative h-full overflow-hidden sm:ig-round">
            <!-- The cards -->
            <div #scroller class="h-full flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar" tabindex="-1">
              @for (c of cards(); track c.key; let i = $index) {
                <article #card [attr.data-i]="i" class="relative shrink-0 w-full h-full snap-center snap-always overflow-hidden"
                         [class.bg-poster-yellow]="c.look === 'ask'" [class.text-ink]="c.look === 'ask'" [attr.aria-label]="c.title">

                  <!-- Background -->
                  @if (c.look === 'ask') {
                    <div class="absolute inset-0 bg-[repeating-linear-gradient(-58deg,transparent_0_46px,rgba(20,18,16,.06)_46px_50px)]" aria-hidden="true"></div>
                    <p class="absolute top-28 left-5 font-display text-[6rem] leading-[0.85] uppercase -rotate-3" aria-hidden="true">Se<br>busca</p>
                  } @else if (c.image) {
                    <img [src]="c.image" alt="" class="absolute inset-0 w-full h-full object-cover" [class.object-top]="c.look === 'gig'"
                         [attr.loading]="i < 2 ? 'eager' : 'lazy'" decoding="async" draggable="false"/>
                    <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" aria-hidden="true"></div>
                    <div class="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/90 via-black/50 to-transparent" aria-hidden="true"></div>
                  } @else if (c.look === 'gig' && c.date) {
                    <div class="absolute inset-0 bg-primary-500 flex flex-col items-center justify-center pb-48" aria-hidden="true">
                      <span class="font-mono text-lg font-bold uppercase tracking-[0.3em]">{{ c.date.weekday }}</span>
                      <span class="font-display text-[11rem] leading-none">{{ c.date.day }}</span>
                      <span class="font-display text-5xl uppercase leading-none">{{ c.date.month }}</span>
                    </div>
                    <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" aria-hidden="true"></div>
                  } @else {
                    <div class="absolute inset-0 flex items-center justify-center pb-40" [style.background]="color(c.title)" aria-hidden="true">
                      <span class="font-display text-[13rem] leading-none text-white/90 uppercase">{{ initial(c.title) }}</span>
                    </div>
                    <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true"></div>
                  }

                  <!-- Tap left = back, right = on; hold = pause (like stories) -->
                  <div class="absolute inset-x-0 top-16 bottom-[42%] flex" aria-hidden="true">
                    <div class="w-1/3 h-full" (pointerdown)="press($event)" (pointerup)="release(-1)" (pointercancel)="cancelPress()" (pointerleave)="cancelPress()"></div>
                    <div class="w-2/3 h-full" (pointerdown)="press($event)" (pointerup)="release(1)" (pointercancel)="cancelPress()" (pointerleave)="cancelPress()"></div>
                  </div>

                  <!-- Caption -->
                  <div class="absolute inset-x-0 bottom-0 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex flex-col gap-3 transition-opacity duration-200"
                       [class.opacity-0]="holding()">
                    <div class="flex flex-col gap-2 px-1">
                      <p class="font-mono text-[11px] font-bold uppercase tracking-wide" [class.text-poster-yellow]="c.look !== 'ask'">{{ c.kicker }}</p>
                      <h2 class="font-display uppercase leading-[0.95] [overflow-wrap:anywhere]"
                          [style.font-size.rem]="c.title.length <= 24 ? 2.9 : 2.3"
                          [style.text-shadow]="c.look === 'ask' ? null : '0 2px 12px rgba(0,0,0,0.35)'">{{ c.title }}</h2>
                      @if (c.subtitle) {
                        <p class="text-[15px] -mt-0.5" [class.text-white/85]="c.look !== 'ask'">{{ c.subtitle }}</p>
                      }
                      @if (c.body) {
                        <p class="text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] line-clamp-5">{{ c.body }}</p>
                      }
                      @if (c.stamp && c.look !== 'ask') {
                        <p class="self-start bg-poster-yellow text-ink font-mono text-xs font-bold uppercase tracking-wide px-3 py-1.5 -rotate-2 shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]">{{ c.stamp }}</p>
                      }
                    </div>

                    @if (playable(c)) {
                      <!-- Music sticker: only the card on screen holds a player, and it starts by itself -->
                      @if (i === active()) {
                        <div class="ig-round overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
                          <app-listen-player [links]="c.links" [who]="''" [autoplay]="true"/>
                        </div>
                      }
                    } @else if (c.kind === 'musician' || c.kind === 'band') {
                      <p class="px-1 font-mono text-[11px] uppercase tracking-wide text-white/55">♫ Aún no ha subido su tema</p>
                    }

                    <!-- Link sticker -->
                    <a [routerLink]="c.route" class="self-center inline-flex items-center gap-2 bg-white text-ink story-ring px-4 py-2.5 min-h-[44px] font-bold text-sm shadow-[0_4px_16px_rgba(0,0,0,0.35)] active:scale-95 transition-transform">
                      <svg class="w-4 h-4 text-[#2f6fed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>
                      <span class="uppercase tracking-wide text-[13px]">{{ c.routeLabel }}</span>
                    </a>

                    <!-- Reply bar -->
                    <div class="flex items-center gap-3">
                      @if (c.contactUserId) {
                        <button type="button" (click)="write(c)" [disabled]="contacting()"
                          class="flex-1 min-h-[46px] story-ring border px-5 text-left text-[15px] truncate disabled:opacity-60"
                          [class.border-white/70]="c.look !== 'ask'" [class.text-white/90]="c.look !== 'ask'" [class.border-ink/60]="c.look === 'ask'">
                          {{ contacting() ? 'Abriendo chat…' : 'Enviar mensaje' }}
                        </button>
                      } @else {
                        <span class="flex-1"></span>
                      }
                      @if (canFavorite(c)) {
                        <button type="button" (click)="toggleFavorite(c)" class="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
                                [attr.aria-label]="isFavorite(c) ? 'Quitar de favoritos' : 'Guardar en favoritos'" [attr.aria-pressed]="isFavorite(c)">
                          <svg class="w-7 h-7" viewBox="0 0 24 24" [attr.fill]="isFavorite(c) ? '#ff3040' : 'none'" [attr.stroke]="isFavorite(c) ? '#ff3040' : 'currentColor'" stroke-width="2" aria-hidden="true">
                            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.9 1.2 5.4 3.2 1.5-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/>
                          </svg>
                        </button>
                      }
                      <button type="button" (click)="share(c)" class="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform" aria-label="Compartir">
                        <svg class="w-7 h-7 -rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M22 3L9.5 13.5M22 3l-7 18-5.5-7.5L2 10z"/></svg>
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>

            <!-- Story bars + header, over the cards -->
            <div class="absolute top-0 inset-x-0 z-10 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none transition-opacity duration-200"
                 [class.opacity-0]="holding()">
              <div class="flex gap-1" aria-hidden="true">
                @for (b of bars(); track b) {
                  <div class="flex-1 h-[3px] story-ring bg-white/35 overflow-hidden">
                    <div class="h-full bg-white" [style.width.%]="b < active() ? 100 : b === active() ? progress() * 100 : 0"></div>
                  </div>
                }
              </div>
              @if (current(); as c) {
                <div class="mt-2.5 flex items-center gap-2.5 pl-1" [class.text-ink]="c.look === 'ask'">
                  <span class="w-8 h-8 story-ring overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        [style.background]="c.image && c.look === 'photo' ? null : color(c.title)">
                    @if (c.image && c.look === 'photo') { <img [src]="c.image" alt="" class="w-full h-full object-cover"/> } @else { {{ initial(c.title) }} }
                  </span>
                  <span class="font-semibold text-sm truncate max-w-[55%]">{{ c.title }}</span>
                  <span class="text-sm opacity-70 flex-shrink-0">{{ when(c) }}</span>
                  @if (paused() && !holding()) { <span class="text-xs opacity-70" aria-hidden="true">❚❚</span> }
                </div>
              }
            </div>
            <div class="absolute top-0 right-0 z-20 flex items-center gap-1 pr-2 pt-[max(1.375rem,calc(env(safe-area-inset-top)+0.875rem))] transition-opacity duration-200"
                 [class.opacity-0]="holding()" [class.text-ink]="current()?.look === 'ask'">
              <button type="button" (click)="openPublish()" class="w-10 h-10 flex items-center justify-center" aria-label="Publicar" aria-haspopup="dialog">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>
              </button>
              <button type="button" (click)="close()" class="w-10 h-10 flex items-center justify-center" aria-label="Cerrar el escaparate">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
          </div>

          <!-- Desktop: round arrows beside the story -->
          <button type="button" (click)="step(-1)" [disabled]="active() === 0"
            class="hidden sm:flex absolute top-1/2 -translate-y-1/2 -left-16 w-10 h-10 story-ring bg-white/90 text-ink items-center justify-center hover:bg-white disabled:opacity-0 transition-opacity" aria-label="Anterior">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button type="button" (click)="step(1)"
            class="hidden sm:flex absolute top-1/2 -translate-y-1/2 -right-16 w-10 h-10 story-ring bg-white/90 text-ink items-center justify-center hover:bg-white transition-opacity" aria-label="Siguiente">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      }

      <app-publish-sheet [(open)]="publishOpen"/>
    </div>
  `,
})
export class ShowcaseComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  readonly auth = inject(AuthService);
  private messages = inject(MessagesService);
  private features = inject(MediaFeaturesService);
  private favorites = inject(FavoritesService);
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
  /** 0…1 of the card on screen; at 1 it moves on by itself. */
  readonly progress = signal(0);
  /** Finger held on the picture: paused, and the overlays hide (like stories). */
  readonly holding = signal(false);
  /** Paused because the visitor is using the player (it took the focus). */
  readonly playerFocus = signal(false);
  readonly paused = computed(() => this.holding() || this.playerFocus() || this.publishOpen());
  readonly current = computed<ShowcaseCard | null>(() => this.cards()[this.active()] ?? null);
  readonly bars = computed(() => {
    const w = progressWindow(this.cards().length, this.active());
    return Array.from({ length: w.count }, (_, k) => w.start + k);
  });
  private readonly favs = signal<ReadonlySet<string>>(new Set());

  private readonly cardEls = viewChildren<ElementRef<HTMLElement>>('card');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private observer: IntersectionObserver | null = null;
  private observed = new Set<HTMLElement>();
  private previousOverflow = '';
  private frame = 0;
  private lastTick = 0;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private pressed = false;
  private touch: { x: number; y: number } | null = null;

  constructor() {
    // Cards arrive after the data loads: watch each one to know which is on screen.
    effect(() => {
      const els = this.cardEls();
      untracked(() => this.observeCards(els));
    });
    // A new card on screen: its bar starts from zero, and it counts as seen.
    effect(() => {
      const c = this.current();
      untracked(() => {
        this.progress.set(0);
        this.playerFocus.set(false);
        if (c) markSeen(c.key);
      });
    });
  }

  ngOnInit() {
    this.seo.set({
      title: 'Escaparate',
      description: 'Músicos, bandas, conciertos y anuncios de la escena, como historias.',
      url: 'https://www.bandyou.es/escaparate',
    });
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void this.load();
    this.lastTick = performance.now();
    this.frame = requestAnimationFrame(t => this.tick(t));
  }

  ngOnDestroy() {
    document.body.style.overflow = this.previousOverflow;
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    if (this.holdTimer) clearTimeout(this.holdTimer);
  }

  /** Fills the bar of the card on screen; moves on (or closes after the last one) when full. */
  private tick(now: number) {
    const dt = now - this.lastTick;
    this.lastTick = now;
    const c = this.current();
    if (c && !this.paused() && !this.loading() && document.visibilityState === 'visible') {
      const next = this.progress() + dt / (cardSeconds(c) * 1000);
      if (next >= 1) {
        this.progress.set(1);
        if (this.active() >= this.cards().length - 1) { this.close(); return; }
        this.step(1);
      } else {
        this.progress.set(next);
      }
    }
    this.frame = requestAnimationFrame(t => this.tick(t));
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
    const me = this.auth.user()?.id ?? null;

    const [musicians, bands, venues, teachers, rehearsals, events, asks, gear, favs] = await Promise.all([
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
      me ? this.favorites.getByUser(me).catch(() => []) : Promise.resolve([]),
    ]);
    this.favs.set(new Set(favs.map(f => `${f.entity_type}:${f.entity_id}`)));
    const all = [
      ...musicians.map(musicianCard), ...bands.map(bandCard), ...venues.map(venueCard), ...teachers.map(teacherCard),
      ...rehearsals.map(rehearsalCard), ...events.map(eventCard), ...asks.map(postCard), ...gear.map(gearCard),
    ];
    let city = '';
    try { city = localStorage.getItem('bandyou_city') || ''; } catch { /* private mode */ }
    // ?p=<key>: start at what was tapped on the home.
    this.cards.set(startAt(showcaseOrder(all, city, me), this.route.snapshot.queryParamMap.get('p')));
    this.loading.set(false);
  }

  playable(c: ShowcaseCard): boolean { return canPlay(c); }
  initial(name: string): string { return initialOf(name); }
  color(name: string): string { return avatarColor(name); }
  /** Next to the name: the gig date, or how long ago it was posted. */
  when(c: ShowcaseCard): string {
    return c.look === 'gig' && c.date ? `${c.date.day} ${c.date.month}` : shortAgo(c.created_at);
  }

  // ── Tap / hold / swipe ──────────────────────────────────────────────────

  press(e: PointerEvent) {
    if (e.button > 0) return;
    this.pressed = true;
    this.holdTimer = setTimeout(() => this.holding.set(true), HOLD_MS);
  }

  release(direction: -1 | 1) {
    if (!this.pressed) return;
    this.pressed = false;
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.holding()) { this.holding.set(false); return; }
    // A tap on the first card's left side restarts it, like stories.
    if (direction === -1 && this.active() === 0) { this.progress.set(0); return; }
    this.step(direction);
  }

  cancelPress() {
    this.pressed = false;
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holding.set(false);
  }

  touchStart(e: TouchEvent) {
    const t = e.touches[0];
    this.touch = t ? { x: t.clientX, y: t.clientY } : null;
  }

  /** Swipe down closes, like stories. */
  touchEnd(e: TouchEvent) {
    const t = e.changedTouches[0];
    if (!this.touch || !t || this.publishOpen()) return;
    const dy = t.clientY - this.touch.y;
    const dx = Math.abs(t.clientX - this.touch.x);
    this.touch = null;
    if (dy > CLOSE_SWIPE_PX && dx < dy / 2) this.close();
  }

  /** Clicking into the music player takes the focus away from the page: pause until they come back. */
  @HostListener('window:blur')
  onBlur() {
    if (document.activeElement?.tagName === 'IFRAME') this.playerFocus.set(true);
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  canFavorite(c: ShowcaseCard): boolean { return this.auth.isLoggedIn() && favoriteType(c) !== null; }
  isFavorite(c: ShowcaseCard): boolean { return this.favs().has(`${favoriteType(c)}:${favoriteId(c)}`); }

  async toggleFavorite(c: ShowcaseCard) {
    const me = this.auth.user()?.id;
    const type = favoriteType(c);
    if (!me || !type) return;
    const key = `${type}:${favoriteId(c)}`;
    const was = this.favs().has(key);
    const flip = (on: boolean) => this.favs.update(s => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    flip(!was);
    try {
      const now = await this.favorites.toggle(me, type, favoriteId(c));
      flip(now);
    } catch {
      flip(was);
      this.toast.error('No se pudo guardar en favoritos.');
    }
  }

  async share(c: ShowcaseCard) {
    const url = `${location.origin}${c.route.join('/')}`;
    this.holding.set(false);
    try {
      if (navigator.share) { await navigator.share({ title: c.title, url }); return; }
      await navigator.clipboard.writeText(url);
      this.toast.success('Enlace copiado.');
    } catch { /* closed the share sheet */ }
  }

  async write(c: ShowcaseCard) {
    if (!this.auth.isLoggedIn()) { void this.router.navigate(['/auth/login']); return; }
    if (this.contacting() || !c.contactUserId) return;
    this.contacting.set(true);
    const result = await this.messages.getOrCreateConversation(c.contactUserId, c.title);
    this.contacting.set(false);
    if (!result || 'error' in result) { this.toast.error(result && 'error' in result ? result.error : 'No se pudo abrir el chat.'); return; }
    void this.router.navigate(['/inbox', result.id]);
  }

  openPublish() { this.publishOpen.set(true); }

  /** One card back (-1) or on (+1). */
  step(delta: number) {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    if (delta > 0 && this.active() >= this.cards().length - 1) { this.close(); return; }
    el.scrollBy({ left: delta * el.clientWidth, behavior: 'smooth' });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.publishOpen()) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
    if (e.key === ' ') { e.preventDefault(); this.holding.update(h => !h); }
  }

  @HostListener('document:keydown.escape')
  close() {
    if (this.publishOpen()) { this.publishOpen.set(false); return; }
    cancelAnimationFrame(this.frame);
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/home']);
  }
}
