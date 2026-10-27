import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { imageSrc } from '../../../core/utils/display.utils';
import { localToday } from '../../../core/utils/date';
import {
  AgendaEvent, QuickFilter, applyQuickFilter, groupAgenda, isFree, posterTilt, posterTone, priceLabel, whenLabel,
} from './agenda';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * The agenda as a "cartelera": the next gig big on top, then a wall of posters
 * grouped by Hoy / Este finde / Esta semana / month. Events without a poster
 * get a typographic one so the wall stays even.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-agenda-board',
  imports: [RouterLink, NgTemplateOutlet],
  styles: [`
    .wall-poster { transform: rotate(var(--tilt)); transition: transform .18s ease, box-shadow .18s ease; }
    .wall-poster:hover, .wall-poster:focus-visible { transform: rotate(0deg) translateY(-3px); }
    .tape { position: absolute; top: -9px; left: 50%; width: 56px; height: 18px; transform: translateX(-50%) rotate(-3deg);
            background: rgba(232, 185, 49, .78); box-shadow: 0 1px 0 rgba(20, 18, 16, .25); z-index: 2; }
    @media (prefers-reduced-motion: reduce) { .wall-poster, .wall-poster:hover { transform: none; transition: none; } }
  `],
  template: `
    <!-- Quick filters on what is loaded -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1" role="group" aria-label="Filtrar la agenda">
      @for (f of filters; track f.id) {
        <button type="button" (click)="quick.set(f.id)" [attr.aria-pressed]="quick() === f.id"
          class="shrink-0 min-h-[40px] px-3.5 border-2 border-ink font-mono text-xs font-bold uppercase tracking-wide transition-colors"
          [class]="quick() === f.id ? 'bg-ink text-poster-paper' : 'bg-transparent text-ink hover:bg-poster-yellow'">
          {{ f.label }}@if (f.id !== 'all') { <span class="opacity-70"> · {{ count(f.id) }}</span> }
        </button>
      }
    </div>

    @if (shown().length === 0) {
      <p class="mt-6 border-2 border-dashed border-ink/40 px-4 py-6 text-center text-sm text-ink-muted">
        Nada {{ quickEmpty() }} por ahora. <button type="button" (click)="quick.set('all')" class="underline font-bold text-ink">Ver toda la agenda</button>
      </p>
    }

    <!-- ── Lo próximo ── -->
    @if (next(); as n) {
      <section class="mt-5 grid grid-cols-[42%_1fr] sm:grid-cols-[minmax(0,15rem)_1fr] gap-4 sm:gap-6 items-stretch bg-ink text-poster-paper border-2 border-ink shadow-[5px_5px_0_0_#c23a1f] p-3 sm:p-5"
               aria-labelledby="next-title">
        <a [routerLink]="['/events', n.id]" class="relative block self-start w-full aspect-[3/4] border-2 border-poster-paper overflow-hidden -rotate-1 hover:rotate-0 transition-transform" tabindex="-1" aria-hidden="true">
          <ng-container [ngTemplateOutlet]="posterArt" [ngTemplateOutletContext]="{ $implicit: n, big: true }"/>
        </a>
        <div class="min-w-0 flex flex-col">
          <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-poster-yellow">Lo próximo</p>
          @if (when(n)) {
            <p class="mt-1 self-start bg-primary-500 text-white font-display uppercase text-lg sm:text-2xl leading-none px-2 py-1 -rotate-2">{{ when(n) }}</p>
          }
          <h2 id="next-title" class="font-display uppercase text-[1.6rem] sm:text-5xl leading-[0.95] mt-2 break-words line-clamp-3">
            <a [routerLink]="['/events', n.id]" class="hover:text-poster-yellow focus-visible:outline-none focus-visible:underline">{{ n.title }}</a>
          </h2>
          <p class="mt-2 text-sm sm:text-base font-semibold">{{ dayLine(n) }}</p>
          <p class="text-sm opacity-80 truncate">{{ n.venue }}@if (n.city) { · {{ n.city }} }</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            @if (price(n)) { <span class="font-mono text-[11px] font-bold uppercase px-1.5 py-0.5" [class]="free(n) ? 'bg-poster-yellow text-ink' : 'border border-poster-paper'">{{ price(n) }}</span> }
            @if (n.genre) { <span class="font-mono text-[11px] font-bold uppercase px-1.5 py-0.5 border border-poster-paper/60">{{ n.genre }}</span> }
          </div>
          <div class="mt-auto pt-3 flex flex-wrap gap-2">
            <a [routerLink]="['/events', n.id]" class="btn-primary min-h-[44px] text-sm px-4">Ver concierto</a>
            @if (n.ticket_url) {
              <a [href]="n.ticket_url" target="_blank" rel="noopener noreferrer" class="min-h-[44px] inline-flex items-center px-4 border-2 border-poster-paper font-mono text-xs font-bold uppercase tracking-wide hover:bg-poster-paper hover:text-ink">
                Entradas<span class="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            }
          </div>
        </div>
      </section>
    }

    <!-- ── The wall, block by block ── -->
    @for (g of groups(); track g.key) {
      <section class="mt-9" [attr.aria-labelledby]="'g-' + g.key">
        <div class="flex items-end gap-3 border-b-[3px] border-ink pb-1.5 mb-6">
          <h2 [id]="'g-' + g.key" class="font-display uppercase leading-none text-5xl sm:text-6xl"
              [class.text-primary-500]="g.key === 'today' || g.key === 'weekend'">{{ g.label }}</h2>
          <span class="pb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {{ g.hint || (g.events.length + (g.events.length === 1 ? ' plan' : ' planes')) }}
          </span>
        </div>
        <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-6">
          @for (e of g.events; track e.id; let i = $index) {
            <li>
              <a [routerLink]="['/events', e.id]" class="wall-poster group relative block bg-white border-2 border-ink shadow-[3px_3px_0_0_#141210] hover:shadow-[6px_6px_0_0_#c23a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                 [style.--tilt]="tilt(i) + 'deg'" [attr.aria-label]="ariaFor(e)">
                <span class="tape" aria-hidden="true"></span>
                <span class="relative block aspect-[3/4] overflow-hidden border-b-2 border-ink">
                  <ng-container [ngTemplateOutlet]="posterArt" [ngTemplateOutletContext]="{ $implicit: e, big: false }"/>
                  <!-- Date stamp -->
                  <span class="absolute top-2 left-2 bg-primary-500 text-white border-2 border-ink -rotate-3 px-1.5 pt-1 pb-0.5 text-center leading-none shadow-[2px_2px_0_0_#141210]">
                    <span class="block font-mono text-[10px] font-bold uppercase">{{ weekday(e) }}</span>
                    <span class="block font-display text-2xl">{{ dayNum(e) }}</span>
                    <span class="block font-mono text-[10px] font-bold uppercase">{{ month(e) }}</span>
                  </span>
                  @if (when(e) === 'Hoy' || when(e) === 'Mañana') {
                    <span class="absolute top-2 right-2 bg-poster-yellow text-ink border-2 border-ink rotate-3 font-display uppercase text-sm leading-none px-1.5 py-1">{{ when(e) }}</span>
                  }
                  @if (price(e)) {
                    <span class="absolute bottom-2 right-2 font-mono text-[11px] font-bold uppercase px-1.5 py-0.5 border-2 border-ink"
                          [class]="free(e) ? 'bg-poster-yellow text-ink' : 'bg-white text-ink'">{{ price(e) }}</span>
                  }
                </span>
                <span class="block px-2.5 py-2">
                  <!-- A typographic poster already shows the title big -->
                  @if (e.image_url) {
                    <span class="block font-display uppercase text-lg leading-[1.05] line-clamp-2 break-words group-hover:text-primary-500">{{ e.title }}</span>
                  }
                  <span class="block mt-1 text-xs text-ink-muted truncate">{{ e.venue }}@if (e.city) { · {{ e.city }} }</span>
                  @if (e.time) { <span class="block font-mono text-[11px] font-bold text-ink">{{ e.time.slice(0, 5) }} h</span> }
                </span>
              </a>
            </li>
          }
        </ul>
      </section>
    }

    <!-- Poster image, or a typographic poster when there is none -->
    <ng-template #posterArt let-e let-big="big">
      @if (e.image_url) {
        <img [src]="imageSrc(e.image_url, big ? 640 : 384)" alt="" class="absolute inset-0 w-full h-full object-cover" [attr.loading]="big ? null : 'lazy'"/>
      } @else {
        <span class="absolute inset-0 flex flex-col justify-end p-3 overflow-hidden" [class]="toneClass(e.id)">
          <span class="absolute -right-3 -top-4 font-display text-[7rem] leading-none opacity-15 select-none" aria-hidden="true">♪</span>
          <span class="font-mono text-[10px] font-bold uppercase tracking-wide opacity-80">{{ e.genre || 'Directo' }}</span>
          <span class="font-display uppercase leading-[0.92] break-words line-clamp-5" [class]="big ? 'text-3xl sm:text-4xl' : 'text-2xl'">{{ e.title }}</span>
          <span class="mt-1.5 border-t-2 border-current pt-1 font-mono text-[10px] font-bold uppercase truncate">{{ e.venue }}</span>
        </span>
      }
    </ng-template>
  `,
})
export class AgendaBoardComponent {
  readonly events = input.required<readonly AgendaEvent[]>();
  /** For tests; the real page uses the local date. */
  readonly today = input<string>(localToday());

  readonly imageSrc = imageSrc;
  readonly quick = signal<QuickFilter>('all');
  readonly filters: readonly { id: QuickFilter; label: string }[] = [
    { id: 'all', label: 'Todo' }, { id: 'today', label: 'Hoy' }, { id: 'weekend', label: 'Este finde' }, { id: 'free', label: 'Gratis' },
  ];

  readonly shown = computed(() => applyQuickFilter(this.events(), this.quick(), this.today()));
  /** The next gig, big on top (only on "Todo", where the wall would repeat it otherwise). */
  readonly next = computed(() => (this.quick() === 'all' ? this.sorted()[0] ?? null : null));
  readonly groups = computed(() => {
    const n = this.next();
    return groupAgenda(n ? this.sorted().slice(1) : this.sorted(), this.today());
  });
  private readonly sorted = computed(() => groupAgenda(this.shown(), this.today()).flatMap(g => g.events));

  count(f: QuickFilter): number { return applyQuickFilter(this.events(), f, this.today()).length; }
  quickEmpty(): string {
    return { all: '', today: 'para hoy', weekend: 'para este finde', free: 'gratis' }[this.quick()];
  }

  when(e: AgendaEvent): string { return whenLabel(e.date, this.today()); }
  price(e: AgendaEvent): string { return priceLabel(e.price); }
  free(e: AgendaEvent): boolean { return isFree(e.price); }
  tilt(i: number): number { return posterTilt(i); }

  private d(e: AgendaEvent): Date {
    const [y, m, dd] = e.date.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, dd);
  }
  weekday(e: AgendaEvent): string { return WEEKDAYS[this.d(e).getDay()]; }
  dayNum(e: AgendaEvent): number { return this.d(e).getDate(); }
  month(e: AgendaEvent): string { return MONTHS[this.d(e).getMonth()]; }
  /** "Viernes 30 de octubre · 23:30" */
  dayLine(e: AgendaEvent): string {
    const long = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][this.d(e).getDay()];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${long} ${this.dayNum(e)} de ${months[this.d(e).getMonth()]}` + (e.time ? ` · ${e.time.slice(0, 5)} h` : '');
  }
  ariaFor(e: AgendaEvent): string {
    return [e.title, this.dayLine(e), e.venue, e.city, this.price(e)].filter(Boolean).join(', ');
  }
  toneClass(id: string): string {
    switch (posterTone(id)) {
      case 'red': return 'bg-primary-500 text-white';
      case 'yellow': return 'bg-poster-yellow text-ink';
      case 'green': return 'bg-[#1d4d3a] text-poster-paper';
      default: return 'bg-ink text-poster-paper';
    }
  }
}
