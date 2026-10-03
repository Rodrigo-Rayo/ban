import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { gearConditionLabel } from '../../../core/constants/gear';

export interface GearCardItem {
  id: string;
  title: string;
  price: number | null;
  category: string | null;
  condition?: string | null;
  city: string | null;
  images: string[] | null;
  status?: string | null;
  seller_name?: string | null;
}

/** One light card for the shop list and "Más en la tienda". */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-gear-card',
  host: { class: 'block h-full' },
  imports: [RouterLink, DecimalPipe],
  template: `
    <a [routerLink]="['/shop', item().id]"
       class="card flex flex-col h-full group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
      <div class="aspect-[4/3] bg-dark-750 relative overflow-hidden border-b border-ink/15">
        @if (item().images?.length) {
          <img [src]="item().images![0]" [alt]="item().title" loading="lazy"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        } @else {
          <div class="w-full h-full flex items-center justify-center p-3 text-center [container-type:inline-size]"
               style="background-image: repeating-linear-gradient(135deg, transparent 0 9px, rgba(20,18,16,0.08) 9px 10px)">
            <span class="font-display text-[clamp(0.8rem,12.5cqw,1.875rem)] uppercase leading-none text-ink/80 [overflow-wrap:normal] [word-break:keep-all] [hyphens:none]">{{ item().category || 'Equipo' }}</span>
          </div>
        }
        @if (item().status === 'sold') {
          <span class="absolute top-2 left-2 tag-night">Vendido</span>
        } @else if (item().status === 'reserved') {
          <span class="absolute top-2 left-2 tag-night">Reservado</span>
        }
      </div>
      <div class="p-3 flex flex-col gap-1 flex-1">
        <p class="font-display text-2xl leading-none text-ink">{{ item().price | number:'1.0-0' }} €</p>
        <p class="text-sm font-semibold text-ink line-clamp-2 min-h-[2.5rem] leading-snug group-hover:text-primary-600 transition-colors">{{ item().title }}</p>
        <p class="meta min-w-0">
          <span class="truncate">{{ metaLine() }}</span>
        </p>
        <p class="text-xs text-ink-muted truncate mt-auto pt-2 min-h-[1.75rem]">{{ item().seller_name }}</p>
      </div>
    </a>
  `,
})
export class GearCardComponent {
  item = input.required<GearCardItem>();

  /** "Bueno · Madrid" — condition and city on a single quiet line. */
  metaLine(): string {
    const i = this.item();
    return [i.condition ? gearConditionLabel(i.condition) : '', i.city ?? ''].filter(Boolean).join(' · ');
  }
}
