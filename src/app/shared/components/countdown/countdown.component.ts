import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';

export interface CountdownParts { days: number; hours: number; minutes: number; seconds: number }

/** Remaining time split into days / hours / minutes / seconds (never negative). */
export function countdownParts(ms: number): CountdownParts {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/**
 * Poster-style live countdown (ticks every second). `offsetMs` shifts "now"
 * (used by the quedada demo mode); `done` fires once when it reaches zero.
 */
@Component({
  selector: 'app-countdown',
  template: `
    @if (compact()) {
      <span class="inline-flex items-baseline gap-1 font-mono font-bold tabular-nums whitespace-nowrap" role="timer" [attr.aria-label]="label()">
        @for (cell of cells(); track cell.unit) {
          <span aria-hidden="true"><span class="font-display text-lg leading-none">{{ cell.value }}</span><span class="text-[10px] uppercase ml-px mr-0.5">{{ cell.short }}</span></span>
        }
      </span>
    } @else {
    <div class="flex items-stretch gap-1.5 sm:gap-2" role="timer" [attr.aria-label]="label()">
      @for (cell of cells(); track cell.unit) {
        <div class="flex flex-col items-center justify-center min-w-[3.25rem] sm:min-w-[4rem] px-1.5 py-1.5 border-2 border-ink"
             [class]="tone() === 'dark' ? 'bg-ink text-poster-paper' : 'bg-dark-900 text-ink'">
          <span class="font-display text-3xl sm:text-4xl leading-none tabular-nums" aria-hidden="true">{{ cell.value }}</span>
          <span class="font-mono text-[10px] font-bold uppercase tracking-wide mt-1 opacity-80" aria-hidden="true">{{ cell.unit }}</span>
        </div>
      }
    </div>
    }
  `,
})
export class CountdownComponent {
  readonly target = input.required<Date>();
  readonly offsetMs = input(0);
  readonly tone = input<'dark' | 'light'>('dark');
  /** One inline line ("3d 20h 59m 57s") instead of the four boxes. */
  readonly compact = input(false);
  readonly done = output<void>();

  private readonly tick = signal(Date.now());
  private fired = false;

  readonly parts = computed(() => countdownParts(this.target().getTime() - (this.tick() + this.offsetMs())));
  readonly cells = computed(() => {
    const p = this.parts();
    const two = (n: number) => String(n).padStart(2, '0');
    return [
      { unit: p.days === 1 ? 'día' : 'días', short: 'd', value: String(p.days) },
      { unit: 'horas', short: 'h', value: two(p.hours) },
      { unit: 'min', short: 'm', value: two(p.minutes) },
      { unit: 'seg', short: 's', value: two(p.seconds) },
    ];
  });
  /** Screen readers get one calm sentence (the role=timer region is not announced every second). */
  readonly label = computed(() => {
    const p = this.parts();
    return `Quedan ${p.days} días, ${p.hours} horas y ${p.minutes} minutos`;
  });

  constructor() {
    // A new target is a new countdown: it may fire `done` again.
    effect(() => { this.target(); this.fired = false; });
    const timer = setInterval(() => {
      this.tick.set(Date.now());
      const p = this.parts();
      if (!this.fired && p.days + p.hours + p.minutes + p.seconds === 0) {
        this.fired = true;
        this.done.emit();
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
