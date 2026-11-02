import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { instrumentIconSrc } from './instrument-icon';

/** Decorative engraving of an instrument: the text next to it already names the instrument. */
@Component({
  selector: 'app-instrument-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="src()" alt="" [width]="size()" [height]="size()" loading="lazy" decoding="async" class="block"/>`,
})
export class InstrumentIconComponent {
  readonly instrument = input<string | null>(null);
  readonly size = input<number>(48);

  readonly src = computed(() => instrumentIconSrc(this.instrument()));
}
