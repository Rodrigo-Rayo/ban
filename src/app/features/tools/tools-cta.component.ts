import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TOOLS_SHARED } from './tools-seo';

/** Small, friendly card under each tool pointing to the rest of BandYou. */
@Component({
  selector: 'app-tools-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <aside class="border-2 border-ink bg-poster-yellow/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
           aria-labelledby="tools-cta-title">
      <p class="text-sm leading-snug">
        <strong id="tools-cta-title" class="font-display text-lg uppercase block leading-none mb-1">{{ cta.title }}</strong>
        {{ cta.text }}
      </p>
      <div class="flex flex-wrap gap-2 shrink-0">
        @for (l of cta.links; track l.href) {
          <!-- Hub pages are server-rendered (api/hub.js), outside the Angular router: plain links. -->
          <a [href]="l.href" class="btn-secondary min-h-[44px] px-4 text-xs">{{ l.label }}</a>
        }
      </div>
    </aside>
  `,
})
export class ToolsCtaComponent {
  readonly cta = TOOLS_SHARED.cta;
}
