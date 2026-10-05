import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

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
    <div class="flex items-stretch gap-1.5 sm:gap-2" role="timer" [attr.aria-label]="label()">
      @for (cell of cells(); track cell.unit) {
        <div class="flex flex-col items-center justify-center min-w-[3.25rem] sm:min-w-[4rem] px-1.5 py-1.5 border-2 border-ink"
             [class]="tone() === 'dark' ? 'bg-ink text-poster-paper' : 'bg-dark-900 text-ink'">
          <span class="font-display text-3xl sm:text-4xl leading-none tabular-nums" aria-hidden="true">{{ cell.value }}</span>
          <span class="font-mono text-[10px] font-bold uppercase tracking-wide mt-1 opacity-80" aria-hidden="true">{{ cell.unit }}</span>
        </div>
      }
    </div>
  `,
})
export class CountdownComponent {
  readonly target = input.required<Date>();
  readonly offsetMs = input(0);
  readonly tone = input<'dark' | 'light'>('dark');
  readonly done = output<void>();

  private readonly tick = signal(Date.now());
  private fired = false;

  readonly parts = computed(() => countdownParts(this.target().getTime() - (this.tick() + this.offsetMs())));
  readonly cells = computed(() => {
    const p = this.parts();
    const two = (n: number) => String(n).padStart(2, '0');
    return [
      { unit: p.days === 1 ? 'día' : 'días', value: String(p.days) },
      { unit: 'horas', value: two(p.hours) },
      { unit: 'min', value: two(p.minutes) },
      { unit: 'seg', value: two(p.seconds) },
    ];
  });
  /** Screen readers get one calm sentence (the role=timer region is not announced every second). */
  readonly label = computed(() => {
    const p = this.parts();
    return `Quedan ${p.days} días, ${p.hours} horas y ${p.minutes} minutos`;
  });

  constructor() {
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
