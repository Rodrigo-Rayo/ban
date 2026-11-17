import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Question, QuestionsService, deadlineLabel, isOpen } from '../../core/services/questions.service';

/** The open question of the month as a poster strip, linking to /pregunta. Renders nothing without one. */
@Component({
  selector: 'app-question-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (question(); as q) {
      <a routerLink="/pregunta" class="group relative block overflow-hidden bg-poster-yellow border-2 border-ink shadow-[5px_5px_0_0_#141210] p-4 sm:p-5 press hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_#141210] transition-all pop-in">
        <span aria-hidden="true" class="pointer-events-none absolute -right-2 -top-6 font-display text-[9rem] leading-none text-ink/10">?</span>
        <span class="relative block font-mono text-[11px] font-bold uppercase tracking-wide">La pregunta del mes · {{ deadline() }}</span>
        <span class="relative block font-display uppercase text-2xl sm:text-3xl leading-[1.05] mt-1.5 pr-8 [text-wrap:balance]">{{ q.title }}</span>
        <span class="relative mt-3 inline-flex items-center gap-2 bg-ink text-poster-paper font-mono text-xs font-bold uppercase tracking-wide px-3 py-2 group-hover:bg-primary-500">
          Responder
          <svg aria-hidden="true" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>
    }
  `,
})
export class QuestionTeaserComponent {
  private svc = inject(QuestionsService);
  readonly question = signal<Question | null>(null);
  readonly deadline = signal('');

  constructor() {
    void this.svc.questions().then(all => {
      const q = all?.find(x => isOpen(x)) ?? null;
      this.question.set(q);
      if (q) this.deadline.set(deadlineLabel(q));
    });
  }
}
