import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TOOLS_SHARED } from '../tools-seo';
import { TUNER_SEO, TunerPage, tuningRowsFor } from './tuner-content';

/**
 * Help below the tuner: intro, how to tune, tunings table, FAQ and links. All copy comes from
 * tuner-seo.json, the same source scripts/prerender-tools.mjs writes into the static HTML.
 */
@Component({
  selector: 'app-tuner-guide',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (page().intro) {
      <p class="mt-8 max-w-2xl text-sm sm:text-base leading-relaxed" data-testid="tuner-intro">{{ page().intro }}</p>
    }

    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-how">
      <h2 id="tg-how" class="font-display text-2xl sm:text-3xl uppercase leading-none">{{ page().howTo.title }}</h2>
      <ol class="mt-4 grid gap-3 text-sm sm:text-base leading-relaxed list-decimal pl-5 max-w-2xl">
        @for (step of page().howTo.steps; track $index) {
          <li>{{ step }}</li>
        }
      </ol>
    </section>

    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-tunings">
      <h2 id="tg-tunings" class="font-display text-2xl sm:text-3xl uppercase leading-none">{{ seo.tuningsTitle }}</h2>
      <p class="mt-2 text-sm text-ink-muted max-w-2xl">{{ seo.tuningsNote }}</p>
      <div class="mt-4 max-w-2xl">
        <table class="w-full text-sm border-2 border-ink bg-dark-800">
          <thead>
            <tr class="bg-ink text-poster-paper font-mono text-[11px] uppercase tracking-wide text-left">
              <th scope="col" class="px-3 py-2">Instrumento</th>
              <th scope="col" class="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="border-t border-ink/20 align-top">
                <th scope="row" class="px-3 py-2 text-left font-semibold">{{ row.instrument }}</th>
                <td class="px-3 py-2">
                  {{ row.notesEs }}
                  <span class="block font-mono text-[11px] text-ink-muted">{{ row.notesEn }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-10 border-t-2 border-ink pt-5" aria-labelledby="tg-faq">
      <h2 id="tg-faq" class="font-display text-2xl sm:text-3xl uppercase leading-none">{{ seo.faqTitle }}</h2>
      <div class="mt-4 grid gap-4 max-w-2xl">
        @for (f of page().faqs; track f.q) {
          <div>
            <h3 class="font-semibold text-base">{{ f.q }}</h3>
            <p class="mt-1 text-sm leading-relaxed">{{ f.a }}</p>
          </div>
        }
      </div>
    </section>

    <nav class="mt-10 border-t-2 border-ink pt-5 max-w-2xl" aria-labelledby="tg-links">
      <h2 id="tg-links" class="font-display text-2xl uppercase leading-none">{{ seo.instrumentLinksTitle }}</h2>
      <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        @for (p of otherPages(); track p.path) {
          <li><a [routerLink]="p.path" class="underline underline-offset-4 hover:text-primary-600 min-h-[44px] inline-flex items-center">{{ p.linkLabel }}</a></li>
        }
        <li><a routerLink="/metronomo" class="underline underline-offset-4 hover:text-primary-600 min-h-[44px] inline-flex items-center">{{ metronomeLabel }}</a></li>
        <li><a routerLink="/feed" class="underline underline-offset-4 hover:text-primary-600 min-h-[44px] inline-flex items-center">{{ feedLabel }}</a></li>
      </ul>
    </nav>
  `,
})
export class TunerGuideComponent {
  readonly page = input.required<TunerPage>();
  readonly seo = TUNER_SEO;
  readonly rows = computed(() => tuningRowsFor(this.page()));
  readonly otherPages = computed(() => TUNER_SEO.pages.filter(p => p.path !== this.page().path));
  readonly metronomeLabel = TOOLS_SHARED.tools.find(t => t.href === '/metronomo')!.label;
  readonly feedLabel = TOOLS_SHARED.moreLinks.find(t => t.href === '/feed')!.label;
}
