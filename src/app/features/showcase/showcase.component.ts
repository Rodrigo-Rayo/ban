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
import { avatarColor } from '../../core/utils/display.utils';
import { initialOf } from '../inbox/profile-avatar';
import {
  ShowcaseBandRow, ShowcaseCard, ShowcaseMusicianRow, bandCard, canPlay, musicianCard, profileLink, showcaseOrder,
} from './showcase';

const PER_KIND = 60;

/**
 * El Escaparate: the scene as full-screen cards, one swipe each (like stories).
 * Only the card on screen can play, so moving on always stops the music.
 */
@Component({
  selector: 'app-showcase',
  imports: [RouterLink, ListenPlayerComponent],
  template: `
    <div class="fixed inset-0 z-[70] bg-ink text-poster-paper" role="dialog" aria-modal="true" aria-label="Escaparate">
      <!-- Top bar -->
      <div class="absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-ink/80 to-transparent pointer-events-none">
        <p class="font-display text-2xl uppercase leading-none">Escapa<span class="text-primary-500">rate</span></p>
        <div class="flex items-center gap-3 pointer-events-auto">
          @if (cards().length) {
            <span class="font-mono text-xs font-bold" aria-live="polite">{{ active() + 1 }} / {{ cards().length }}</span>
          }
          <button type="button" (click)="close()" class="w-11 h-11 flex items-center justify-center border-2 border-poster-paper hover:bg-poster-paper hover:text-ink transition-colors" aria-label="Cerrar el escaparate">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="h-full flex items-center justify-center font-mono text-xs uppercase tracking-wide" role="status">Cargando la escena…</div>
      } @else if (!cards().length) {
        <div class="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p class="font-display text-3xl uppercase">Aún no hay nadie aquí</p>
          <button type="button" (click)="close()" class="btn-primary min-h-[44px] px-6">Volver</button>
        </div>
      } @else {
        <div #scroller class="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain no-scrollbar" tabindex="-1">
          @for (c of cards(); track c.key; let i = $index) {
            <article #card [attr.data-i]="i" class="relative h-[100dvh] snap-start snap-always flex justify-center"
                     [attr.aria-label]="c.name">
              <div class="relative h-full w-full sm:max-w-[30rem] overflow-hidden sm:border-x-2 sm:border-poster-paper/20">
                <!-- Picture, or a poster with the initial -->
                @if (c.avatar_url) {
                  <img [src]="c.avatar_url" alt="" class="absolute inset-0 w-full h-full object-cover"
                       [attr.loading]="i < 2 ? 'eager' : 'lazy'" decoding="async"/>
                } @else {
                  <div class="absolute inset-0 flex items-center justify-center" [style.background]="color(c.name)" aria-hidden="true">
                    <span class="font-display text-[14rem] leading-none text-poster-paper/90 uppercase">{{ initial(c.name) }}</span>
                  </div>
                }
                <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden="true"></div>

                <!-- Who -->
                <div class="absolute inset-x-0 bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
                  <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-poster-yellow">
                    {{ c.kind === 'band' ? 'Banda' : 'Músico' }}@if (c.role) { · {{ c.role }} }@if (c.city) { · {{ c.city }} }
                  </p>
                  <h2 class="font-display text-5xl sm:text-6xl uppercase leading-[0.95] [overflow-wrap:anywhere]">{{ c.name }}</h2>
                  @if (c.genre && c.kind === 'musician') {
                    <p class="text-sm text-poster-paper/80 -mt-1">{{ c.genre }}</p>
                  }
                  @if (c.looking_for) {
                    <p class="self-start bg-poster-yellow text-ink border-2 border-ink font-mono text-xs font-bold uppercase tracking-wide px-3 py-1.5 -rotate-1">Buscan {{ c.looking_for }}</p>
                  }

                  @if (playable(c)) {
                    @if (i === active()) {
                      <app-listen-player [links]="c.links" [who]="''"/>
                    } @else {
                      <div class="h-[72px]" aria-hidden="true"></div>
                    }
                  } @else {
                    <p class="font-mono text-[11px] uppercase tracking-wide text-poster-paper/60">Aún no ha subido su tema</p>
                  }

                  <div class="grid grid-cols-2 gap-2">
                    <a [routerLink]="link(c)" class="min-h-[48px] flex items-center justify-center border-2 border-poster-paper font-mono text-xs font-bold uppercase tracking-wide hover:bg-poster-paper hover:text-ink transition-colors">Ver perfil</a>
                    <button type="button" (click)="write(c)" [disabled]="contacting()"
                      class="btn-primary min-h-[48px] disabled:opacity-60">{{ contacting() ? 'Abriendo…' : 'Escribir' }}</button>
                  </div>
                  @if (i === 0 && cards().length > 1) {
                    <p class="text-center font-mono text-[11px] uppercase tracking-wide text-poster-paper/60 animate-bounce" aria-hidden="true">Desliza ↑</p>
                  }
                </div>
              </div>
            </article>
          }
        </div>
        <!-- Desktop: previous / next -->
        <div class="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-2">
          <button type="button" (click)="step(-1)" [disabled]="active() === 0" class="w-11 h-11 flex items-center justify-center border-2 border-poster-paper hover:bg-poster-paper hover:text-ink disabled:opacity-30 transition-colors" aria-label="Anterior">▲</button>
          <button type="button" (click)="step(1)" [disabled]="active() === cards().length - 1" class="w-11 h-11 flex items-center justify-center border-2 border-poster-paper hover:bg-poster-paper hover:text-ink disabled:opacity-30 transition-colors" aria-label="Siguiente">▼</button>
        </div>
      }
    </div>
  `,
})
export class ShowcaseComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
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
      description: 'Desliza y escucha a los músicos y bandas de tu provincia.',
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
      if (!this.observed.has(el)) { this.observed.add(el); this.observer?.observe(el); }
    }
  }

  private async load() {
    const db = this.supabase.client;
    const demo = (await this.features.has('demoUrl')) ? ', demo_url' : '';
    const media = 'spotify_url, soundcloud_url, youtube_url' + demo;
    const [m, b] = await Promise.all([
      db.from('musicians').select(`id, user_id, name, instrument, genre, city, avatar_url, created_at, ${media}`)
        .order('created_at', { ascending: false }).limit(PER_KIND).then(r => r, () => ({ data: null })),
      db.from('bands').select(`id, user_id, name, genre, city, avatar_url, looking_for, created_at, ${media}`)
        .order('created_at', { ascending: false }).limit(PER_KIND).then(r => r, () => ({ data: null })),
    ]);
    const all = [
      ...((m.data ?? []) as unknown as ShowcaseMusicianRow[]).map(musicianCard),
      ...((b.data ?? []) as unknown as ShowcaseBandRow[]).map(bandCard),
    ];
    let city = '';
    try { city = localStorage.getItem('bandyou_city') || ''; } catch { /* private mode */ }
    const ordered = showcaseOrder(all, city, this.auth.user()?.id ?? null);
    // ?p=<key>: start at that person (the home circles link here).
    const start = this.route.snapshot.queryParamMap.get('p');
    const at = start ? ordered.findIndex(c => c.key === start) : -1;
    this.cards.set(at > 0 ? [ordered[at], ...ordered.slice(0, at), ...ordered.slice(at + 1)] : ordered);
    this.loading.set(false);
  }

  playable(c: ShowcaseCard): boolean { return canPlay(c); }
  link(c: ShowcaseCard): string[] { return profileLink(c); }
  initial(name: string): string { return initialOf(name); }
  color(name: string): string { return avatarColor(name); }

  async write(c: ShowcaseCard) {
    if (!this.auth.isLoggedIn()) { void this.router.navigate(['/auth/login']); return; }
    if (this.contacting() || !c.user_id) return;
    this.contacting.set(true);
    const result = await this.messages.getOrCreateConversation(c.user_id, c.name);
    this.contacting.set(false);
    if (!result || 'error' in result) { this.toast.error(result && 'error' in result ? result.error : 'No se pudo abrir el chat.'); return; }
    void this.router.navigate(['/inbox', result.id]);
  }

  /** One card up (-1) or down (+1). */
  step(delta: number) {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollBy({ top: delta * el.clientHeight, behavior: 'smooth' });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); this.step(1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); this.step(-1); }
  }

  @HostListener('document:keydown.escape')
  close() {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/home']);
  }
}
