import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { INSTRUMENT_ICONS, instrumentIconKey } from './instrument-icon';

/**
 * Decorative instrument icon. The text next to it already names the instrument,
 * so the svg is aria-hidden. Draws in currentColor.
 */
@Component({
  selector: 'app-instrument-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [innerHTML]="svg()" class="inline-flex leading-none"></span>`,
})
export class InstrumentIconComponent {
  private sanitizer = inject(DomSanitizer);

  readonly instrument = input<string | null>(null);
  readonly size = input<number>(28);

  readonly svg = computed(() => {
    const safeSize = Number.isFinite(+this.size()) ? +this.size() : 28;
    const markup = INSTRUMENT_ICONS[instrumentIconKey(this.instrument())];
    const html = `<svg aria-hidden="true" width="${safeSize}" height="${safeSize}" viewBox="0 0 512 512" fill="currentColor">${markup}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });
}
