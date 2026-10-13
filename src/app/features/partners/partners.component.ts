import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PARTNERS, Partner, partnerRel } from './partners';
import { LEGAL_INFO } from '../legal/legal-info';

/** /colaboradores: the people who have helped BandYou, each with a link to their site. */
@Component({
  selector: 'app-partners',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="min-h-screen bg-dark-900" style="padding-top:64px; padding-bottom:80px">
      <header class="page-head bg-dark-900">
        <div class="page-head-inner">
          <div>
            <p class="page-kicker">Gracias</p>
            <h1 class="page-title">Colaboradores</h1>
          </div>
        </div>
      </header>

      <div class="page-wrap py-6">
        <p class="text-base sm:text-lg max-w-2xl leading-relaxed">
          Gente de la escena que nos ha echado una mano. Si hacemos algo juntos, aparecéis aquí.
        </p>

        <ul class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of partners; track p.name; let i = $index) {
            <li class="card-flat flex flex-col p-5 border-2 border-ink shadow-[4px_4px_0_0_#141210]"
                [class.-rotate-1]="i % 2 === 0" [class.rotate-1]="i % 2 === 1">
              <h2 class="font-display text-3xl uppercase leading-none [overflow-wrap:anywhere]">{{ p.name }}</h2>
              <div class="mt-4 flex flex-wrap gap-2">
                <a [href]="p.url" target="_blank" [attr.rel]="rel(p)" class="btn-secondary min-h-[44px] px-4 text-xs">
                  {{ host(p.url) }} <app-icon name="external-link" [size]="14"/><span class="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
                @if (p.instagram) {
                  <a [href]="'https://www.instagram.com/' + p.instagram" target="_blank" rel="noopener"
                     class="btn-ghost min-h-[44px] px-3 text-xs" [attr.aria-label]="'Instagram de ' + p.name + ' (se abre en una pestaña nueva)'">
                    <app-icon name="instagram" [size]="16"/> &#64;{{ p.instagram }}
                  </a>
                }
                @if (p.profile) {
                  <a [routerLink]="p.profile" class="btn-ghost min-h-[44px] px-3 text-xs">Su perfil en BandYou</a>
                }
              </div>
            </li>
          }
        </ul>

        <section class="mt-10 border-t-2 border-ink pt-5 max-w-2xl" aria-labelledby="partners-join">
          <h2 id="partners-join" class="font-display text-2xl uppercase leading-none">¿Hacemos algo juntos?</h2>
          <p class="text-sm leading-relaxed mt-2">
            Salas, locales de ensayo, profes, tiendas, fotógrafos, medios… Escríbenos y lo hablamos.
          </p>
          <a [href]="'mailto:' + email" class="btn-primary min-h-[44px] mt-4 px-6">{{ email }}</a>
        </section>
      </div>
    </div>
  `,
})
export class PartnersComponent implements OnInit {
  private seo = inject(SeoService);
  readonly partners = PARTNERS;
  readonly email = LEGAL_INFO.legalEmail;

  ngOnInit() {
    this.seo.set({
      title: 'Colaboradores',
      description: 'Salas, medios, promotoras y gente de la escena musical que colabora con BandYou.',
      url: 'https://www.bandyou.es/colaboradores',
    });
  }

  rel(p: Partner): string { return partnerRel(p); }
  host(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }
}
