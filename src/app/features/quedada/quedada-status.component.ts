import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { QuedadaEntry, QuedadaService, QuedadaWinner } from './quedada.service';
import { CountdownComponent } from '../../shared/components/countdown/countdown.component';
import {
  QuedadaCycle, drawAt, drawnCycle, gigInstant, madridMonth, monthName, openCycle, previousCycle,
} from '../../core/utils/quedada-cycle';
import { dateParts } from '../../core/utils/date';

export type QuedadaPhase = 'signup' | 'winner';

export interface QuedadaSnapshot {
  phase: QuedadaPhase;
  open: QuedadaCycle;
  entries: QuedadaEntry[];
  winner: QuedadaWinner | null;
}

/** After this long past the start time a gig counts as played and sign-up for the next draw takes over. */
const GIG_LENGTH_MS = 4 * 3_600_000;

/** Provinces where nobody can take part (no real province chosen). */
export const NO_PROVINCE = ['', 'Otra', 'Toda España'];

/**
 * "La quedada de BandYou" status block: sign-up with a countdown to the draw, or
 * the winner with a countdown to the gig. Once the gig is over, sign-up returns.
 * Used on the home (compact) and at the top of /quedada.
 */
@Component({
  selector: 'app-quedada-status',
  imports: [RouterLink, NgTemplateOutlet, CountdownComponent],
  template: `
    @if (snapshot(); as s) {
      @if (variant() === 'home') {
        <!-- Home: one compact strip that links to /quedada; the full poster lives on that page -->
        <a routerLink="/quedada" [queryParams]="demoParams"
           class="press group relative flex items-center gap-3 bg-poster-yellow text-ink border-2 border-ink shadow-[4px_4px_0_0_#141210] p-3 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
           [attr.aria-label]="compactLabel(s)">
          @if (s.phase === 'winner' && s.winner) {
            <span class="absolute -top-2.5 right-3 rotate-[4deg] bg-primary-500 text-white border-2 border-ink font-display uppercase text-sm leading-none px-2 py-1" aria-hidden="true">¡Ganador!</span>
            @if (s.winner.event.image_url) {
              <img [src]="s.winner.event.image_url" alt="" class="w-12 h-16 object-cover border-2 border-ink -rotate-2 flex-shrink-0 bg-ink" loading="lazy"/>
            }
          }
          <span class="flex-1 min-w-0" aria-hidden="true">
            <span class="inline-block -rotate-1 bg-ink text-poster-yellow font-display uppercase text-sm leading-none px-2 py-1">★ La quedada de BandYou</span>
            @if (s.phase === 'winner' && s.winner; as w) {
              <span class="block font-display uppercase text-xl leading-tight truncate mt-1">{{ w.event.owner_name }}</span>
              <span class="flex items-baseline gap-2 flex-wrap text-xs font-semibold">
                <span>Faltan</span><app-countdown [target]="gigTime(w)" [offsetMs]="offset" [compact]="true" (done)="onCountdownDone()"/>
                <span class="text-ink/70">· {{ going() }} {{ going() === 1 ? 'va' : 'van' }}</span>
              </span>
            } @else {
              <span class="block font-display uppercase text-xl leading-tight truncate mt-1">Tu bolo, en la portada{{ noProvince() ? '' : ' de ' + province() }}</span>
              <span class="flex items-baseline gap-2 flex-wrap text-xs font-semibold">
                <span>Sorteo en</span><app-countdown [target]="drawTime(s.open)" [offsetMs]="offset" [compact]="true" (done)="onCountdownDone()"/>
                <span class="text-ink/70">· {{ s.entries.length }} {{ s.entries.length === 1 ? 'inscrito' : 'inscritos' }}</span>
              </span>
            }
          </span>
          <span class="font-display text-2xl leading-none flex-shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
        </a>
      } @else if (s.phase === 'signup') {
        <section class="bg-poster-yellow text-ink border-2 border-ink shadow-[5px_5px_0_0_#141210] p-4 sm:p-6" [attr.aria-labelledby]="uid + '-t'">
          <ng-container [ngTemplateOutlet]="brand" [ngTemplateOutletContext]="{ sub: monthLabel(s.open) + (noProvince() ? '' : ' en ' + province()) }"/>
          <h2 [id]="uid + '-t'" class="font-display uppercase leading-[0.95] mt-3" [class]="variant() === 'page' ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'">¡Bandas!<br>¡Esto os interesa!</h2>
          <p class="text-[15px] leading-snug mt-3 max-w-[52ch]">
            <strong>Ayudamos a las bandas pequeñas a darse a conocer.</strong>
            Cada mes sorteamos un bolo por provincia, lo promocionamos en toda la web y quedamos para ir.
            Inscribe el tuyo antes del <strong>10 de {{ monthLabel(s.open) }} a las 20:00</strong>.
          </p>
          <p class="font-mono text-[11px] font-bold uppercase tracking-wide mt-4 mb-1.5">Sorteo en</p>
          <app-countdown [target]="drawTime(s.open)" [offsetMs]="offset" (done)="onCountdownDone()"/>
          <p class="text-sm mt-4 font-semibold">
            @if (noProvince()) {
              Elige tu provincia en tu perfil para participar.
            } @else if (s.entries.length === 0) {
              Nadie se ha inscrito todavía en {{ province() }}. Si eres el único, ganas.
            } @else {
              {{ s.entries.length }} {{ s.entries.length === 1 ? 'bolo inscrito' : 'bolos inscritos' }} en {{ province() }}:
              <span class="font-normal">{{ entryNames(s.entries) }}</span>
            }
          </p>
          <div class="flex flex-wrap gap-2 mt-4">
            <a routerLink="/quedada" [queryParams]="demoParams" fragment="inscribir" class="btn-night min-h-[44px] text-xs px-5">Inscribe tu bolo</a>
            @if (variant() === 'home') {
              <a routerLink="/quedada" [queryParams]="demoParams" class="btn-secondary min-h-[44px] text-xs px-5">Cómo funciona</a>
            }
          </div>
        </section>
      } @else if (s.winner; as w) {
        <!-- Same yellow poster as the sign-up, now with a red "¡Ganador!" stamp; the gig's own poster on the side when it has one -->
        <section class="relative bg-poster-yellow text-ink border-2 border-ink shadow-[5px_5px_0_0_#141210]" [attr.aria-labelledby]="uid + '-t'">
          <span class="absolute -top-3 right-3 sm:right-5 z-10 rotate-[4deg] bg-primary-500 text-white border-2 border-ink font-display uppercase text-lg sm:text-xl leading-none px-3 py-1.5 shadow-[2px_2px_0_0_#141210]" aria-hidden="true">¡Ganador!</span>
          <div class="grid" [class.sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]]="!!w.event.image_url">
            @if (w.event.image_url) {
              <div class="p-3 sm:p-4 sm:pr-0">
                <img [src]="w.event.image_url" [alt]="'Cartel: ' + w.event.title"
                     class="w-full aspect-[3/4] max-h-60 sm:max-h-none object-cover border-2 border-ink -rotate-1 shadow-[3px_3px_0_0_#141210] bg-ink" loading="lazy"/>
              </div>
            }
            <div class="p-4 sm:p-6 min-w-0">
              <ng-container [ngTemplateOutlet]="brand" [ngTemplateOutletContext]="{ sub: 'Ganador de ' + monthLabel(cycleOf(w)) + ' en ' + w.province }"/>
              <h2 [id]="uid + '-t'" class="font-display uppercase leading-[0.95] mt-3 [overflow-wrap:anywhere]" [class]="variant() === 'page' ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'">
                {{ w.event.owner_name }}
              </h2>
              <p class="text-[15px] mt-2 [overflow-wrap:anywhere]"><strong>{{ w.event.title }}</strong></p>
              <p class="font-mono text-xs font-bold uppercase tracking-wide mt-2">{{ gigLine(w) }}</p>
              <p class="font-mono text-[11px] font-bold uppercase tracking-wide mt-4 mb-1.5">Faltan</p>
              <app-countdown [target]="gigTime(w)" [offsetMs]="offset" (done)="onCountdownDone()"/>
              <p class="text-sm mt-4 font-semibold">{{ going() > 0 ? going() + (going() === 1 ? ' persona va' : ' personas van') + '. ¿Te apuntas?' : 'Sé el primero en apuntarte.' }}</p>
              @if (variant() === 'home') {
                <a routerLink="/quedada" [queryParams]="demoParams" class="btn-primary mt-4 min-h-[44px] text-xs px-5">¡Voy! · Ver la quedada</a>
              }
              <p class="font-mono text-[11px] font-bold uppercase tracking-wide mt-4 text-ink/70">
                Próximo sorteo: 10 de {{ monthLabel(s.open) }} a las 20:00 · {{ s.entries.length }} {{ s.entries.length === 1 ? 'bolo inscrito' : 'bolos inscritos' }} ·
                <a routerLink="/quedada" [queryParams]="demoParams" fragment="inscribir" class="underline hover:text-primary-600">Inscribe el tuyo</a>
              </p>
            </div>
          </div>
        </section>
      }
    } @else if (loading()) {
      <div class="border-2 border-ink/30 bg-dark-800/40 animate-pulse" [class]="variant() === 'home' ? 'h-20' : 'h-64'" aria-hidden="true"></div>
    }

    <!-- The brand label: like a strip of black tape on the poster -->
    <ng-template #brand let-sub="sub">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="inline-block -rotate-1 bg-ink text-poster-yellow font-display uppercase text-xl sm:text-2xl leading-none px-2.5 py-1.5">★ La quedada de BandYou</span>
        <span class="font-mono text-[11px] font-bold uppercase tracking-wide">{{ sub }}</span>
      </p>
    </ng-template>
  `,
})
export class QuedadaStatusComponent {
  private svc = inject(QuedadaService);

  readonly province = input.required<string>();
  readonly variant = input<'home' | 'page'>('home');
  /** Bump to reload (after signing up or withdrawing). */
  readonly refresh = input(0);
  readonly loaded = output<QuedadaSnapshot>();

  readonly uid = 'quedada-' + Math.random().toString(36).slice(2, 7);
  readonly snapshot = signal<QuedadaSnapshot | null>(null);
  /** Only once the feature is known to exist: no placeholder (and no jump) where it is not. */
  readonly loading = signal(false);
  readonly going = signal(0);
  readonly noProvince = computed(() => NO_PROVINCE.includes(this.province()));
  /** Demo mode keeps ?demo= on internal links. */
  readonly demoParams = this.svc.demoState ? { demo: this.svc.demoState } : null;
  /** Demo mode shifts the clock. */
  readonly offset = this.svc.now().getTime() - Date.now();
  private seq = 0;

  constructor() {
    effect(() => { this.refresh(); void this.load(this.province()); });
  }

  reload() { void this.load(this.province()); }

  private async load(province: string) {
    const seq = ++this.seq;
    if (!(await this.svc.available())) return;
    if (!this.snapshot()) this.loading.set(true);
    const now = this.svc.now();
    const open = openCycle(now);
    // Before this month's draw, last month's winner may still be about to play (late on the 31st).
    const drawn = drawnCycle(now) ?? previousCycle(madridMonth(now));
    const real = !NO_PROVINCE.includes(province);
    const [winner, entries] = await Promise.all([
      real ? this.svc.winner(drawn, province) : Promise.resolve(null),
      real ? this.svc.entries(open, province) : Promise.resolve([]),
    ]);
    const going = winner ? await this.svc.attendeeCount(winner.event.id) : 0;
    if (seq !== this.seq) return; // a newer load (province change) won
    // The winner is on show until its gig is over; then sign-up for the next draw takes over.
    const playing = !!winner && gigInstant(winner.event.date, winner.event.time).getTime() + GIG_LENGTH_MS > now.getTime();
    const phase: QuedadaPhase = playing ? 'winner' : 'signup';
    this.going.set(going);
    const snap = { phase, open, entries, winner };
    this.snapshot.set(snap);
    this.loading.set(false);
    this.loaded.emit(snap);
  }

  /** A countdown hit zero: reload now and again shortly after (the device clock may run ahead of the server). */
  onCountdownDone() {
    const drawn = drawnCycle(this.svc.now());
    if (drawn) this.svc.retryDraw(drawn);
    this.reload();
    setTimeout(() => {
      const again = drawnCycle(this.svc.now());
      if (again) this.svc.retryDraw(again);
      this.reload();
    }, 6000);
  }

  monthLabel(c: QuedadaCycle): string { return monthName(c); }
  drawTime(c: QuedadaCycle): Date { return drawAt(c); }
  gigTime(w: QuedadaWinner): Date { return gigInstant(w.event.date, w.event.time); }
  cycleOf(w: QuedadaWinner): QuedadaCycle {
    const [y, m] = (w.cycle || '').split('-').map(Number);
    return y && m ? { year: y, month: m } : madridMonth(this.svc.now());
  }
  gigLine(w: QuedadaWinner): string {
    const p = dateParts(w.event.date.slice(0, 10));
    const when = p ? `${p.weekday} ${p.day} ${p.month}` : w.event.date;
    return [when, w.event.time?.slice(0, 5), w.event.venue].filter(Boolean).join(' · ');
  }
  /** One sentence for screen readers on the compact home strip. */
  compactLabel(s: QuedadaSnapshot): string {
    if (s.phase === 'winner' && s.winner) {
      return `La quedada de BandYou: ganador ${s.winner.event.owner_name}, ${this.gigLine(s.winner)}. ${this.going()} personas van. Ver la quedada.`;
    }
    const where = this.noProvince() ? '' : ` en ${this.province()}`;
    return `La quedada de BandYou: tu bolo, en la portada${where ? ' de' + where.replace(' en', '') : ''}. Sorteo el 10 de ${this.monthLabel(s.open)} a las 20:00. ${s.entries.length} inscritos. Ver la quedada.`;
  }

  entryNames(entries: QuedadaEntry[]): string {
    const names = entries.map(e => e.event.owner_name);
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} y ${names.length - 4} más` : names.join(', ');
  }
}
