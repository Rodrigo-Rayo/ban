import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { Challenge, ChallengePhase, challengePhase, timeLeft } from '../../core/utils/reto';
import { RetoService } from './reto.service';

/** Home strip for the Reto del mes. Renders nothing until its tables exist or while there is no reto. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reto-banner',
  imports: [RouterLink],
  template: `
    @if (challenge(); as c) {
      <a routerLink="/reto" class="press block border-2 border-ink bg-poster-yellow px-4 py-3 hover:bg-poster-yellow/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
        <span class="block font-mono text-[11px] font-bold uppercase tracking-wide text-ink">Reto del mes · {{ status() }}</span>
        <span class="block font-display text-2xl uppercase leading-tight text-ink mt-1 [overflow-wrap:anywhere]">{{ c.title }}</span>
        <span class="block font-mono text-xs font-bold uppercase tracking-wide text-ink mt-2">{{ cta() }} →</span>
      </a>
    }
  `,
})
export class RetoBannerComponent implements OnInit {
  private features = inject(MediaFeaturesService);
  private reto = inject(RetoService);

  readonly challenge = signal<Challenge | null>(null);
  readonly status = signal('');
  readonly cta = signal('');

  async ngOnInit() {
    try {
      if (!(await this.features.has('reto'))) return;
      const c = await this.reto.current();
      if (!c) return;
      const phase: ChallengePhase = challengePhase(c);
      if (phase === 'closed') { this.status.set('Ya hay ganador'); this.cta.set('Ver quién ganó'); }
      else if (phase === 'voting') { this.status.set(timeLeft(c.votes_until) || 'Votación abierta'); this.cta.set('Vota a tu favorito'); }
      else { this.status.set(timeLeft(c.entries_until) || 'Abierto'); this.cta.set('Participa y vota'); }
      this.challenge.set(c);
    } catch { /* the home works without it */ }
  }
}
