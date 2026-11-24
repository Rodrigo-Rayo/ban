import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HubKind, HubLinkItem, genreHubLink, hubPath, instrumentHubLink } from '../../../core/utils/hub-link';
import { isSpanishProvince } from '../../../core/utils/place';

/** "Más músicos en Madrid →", from a profile or an ad to the page of its province. */
@Component({
  selector: 'app-hub-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6">
      <a [href]="href()" class="inline-flex items-center min-h-[44px] font-mono text-xs font-bold uppercase tracking-wide underline hover:text-primary-500">{{ text() }} →</a>
      @for (l of more(); track l.href) {
        <a [href]="l.href" class="inline-flex items-center min-h-[44px] ml-4 font-mono text-xs font-bold uppercase tracking-wide underline hover:text-primary-500">{{ l.text }} →</a>
      }
    </div>
  `,
})
export class HubLinkComponent {
  readonly kind = input.required<HubKind>();
  readonly city = input<string | null | undefined>(null);
  /** "Más músicos", "Más anuncios"… */
  readonly label = input.required<string>();
  /** Profile instrument and style lists ("Guitarra, Voz"): also link their province pages. */
  readonly instruments = input<string | null | undefined>(null);
  readonly genres = input<string | null | undefined>(null);

  readonly more = computed(() => [instrumentHubLink(this.instruments(), this.city()), genreHubLink(this.genres(), this.city())]
    .filter((l): l is HubLinkItem => !!l));

  readonly href = computed(() => hubPath(this.kind(), this.city()));
  readonly text = computed(() => {
    const province = this.href().split('/').length > 2;
    if (province) return `${this.label()} en ${this.city()}`;
    // Outside Spain there is no page per place yet: the link goes to the whole list.
    return isSpanishProvince(this.city()) || !this.city() ? `${this.label()} en España` : `${this.label()} en BandYou`;
  });
}
