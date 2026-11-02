import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The server-rendered pages (province pages, guides) in every footer. They live outside the
 * Angular router, hence plain hrefs, and without these links nothing in the app reaches them.
 */
@Component({
  selector: 'app-explore-links',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <nav aria-label="Explorar BandYou" class="grid gap-3 font-mono text-[11px] font-bold uppercase text-ink-muted">
      <ul class="flex flex-wrap gap-x-5 gap-y-1">
        @for (l of sections; track l.href) {
          <li><a [href]="l.href" class="hover:text-ink min-h-[44px] sm:min-h-0 inline-flex items-center">{{ l.label }}</a></li>
        }
      </ul>
      <ul class="flex flex-wrap gap-x-5 gap-y-1">
        @for (l of provinces; track l.href) {
          <li><a [href]="l.href" class="hover:text-ink min-h-[44px] sm:min-h-0 inline-flex items-center">{{ l.label }}</a></li>
        }
      </ul>
    </nav>
  `,
})
export class ExploreLinksComponent {
  readonly sections = [
    { href: '/busco-banda', label: 'Busco banda' },
    { href: '/busco-musicos', label: 'Busco músicos' },
    { href: '/musicos', label: 'Músicos' },
    { href: '/bandas', label: 'Bandas' },
    { href: '/locales-de-ensayo', label: 'Locales de ensayo' },
    { href: '/clases-de-musica', label: 'Clases de música' },
    { href: '/salas-de-conciertos', label: 'Salas de conciertos' },
    { href: '/conciertos', label: 'Conciertos' },
    { href: '/guias', label: 'Guías' },
  ];
  readonly provinces = [
    { href: '/busco-banda/madrid', label: 'Busco banda en Madrid' },
    { href: '/busco-banda/barcelona', label: 'Busco banda en Barcelona' },
    { href: '/busco-banda/valencia', label: 'Busco banda en Valencia' },
    { href: '/busco-musicos/madrid', label: 'Busco músicos en Madrid' },
  ];
}
