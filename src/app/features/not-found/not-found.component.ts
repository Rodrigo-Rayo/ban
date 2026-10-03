import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-not-found',
    imports: [RouterLink],
    template: `
    <div class="min-h-screen bg-dark-900 pt-16">
      <div class="page-wrap py-16 lg:py-24">
        <p class="page-kicker">Error 404</p>
        <h1 class="text-6xl sm:text-8xl leading-[1.05] max-w-3xl">Esta página no existe</h1>
        <p class="mt-5 text-base text-ink-muted max-w-md leading-relaxed">
          El enlace está mal escrito o la página ya no está. Vuelve a la portada o busca lo que necesitas.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row gap-3">
          <a [routerLink]="auth.isLoggedIn() ? '/home' : '/'" aria-label="Ir a la portada (inicio)" class="btn-primary px-8 py-3.5 text-sm min-h-[48px]">Ir a la portada</a>
          <a routerLink="/search" class="btn-secondary px-8 py-3.5 text-sm min-h-[48px]">Buscar</a>
        </div>
      </div>
    </div>
  `
})
export class NotFoundComponent implements OnInit {
  protected auth = inject(AuthService);
  private seo = inject(SeoService);
  private meta = inject(Meta);

  ngOnInit() {
    this.seo.set({ title: 'Página no encontrada' });
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
