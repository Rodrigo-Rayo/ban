import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-not-found',
    imports: [RouterLink],
    template: `
    <div class="min-h-screen bg-dark-900 flex items-center justify-center px-6" style="padding-top:64px; padding-bottom:64px">
      <div class="text-center max-w-sm">
        <div class="text-8xl sm:text-9xl font-black text-primary-500/15 leading-none mb-4 select-none">404</div>
        <h1 class="text-2xl font-bold text-ink mb-2">Página no encontrada</h1>
        <p class="text-sm text-ink-muted mb-8 leading-relaxed">
          Este enlace no existe o ha sido eliminado.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a [routerLink]="auth.isLoggedIn() ? '/home' : '/'" class="btn-primary px-6 py-3 text-sm min-h-[44px]">Ir al inicio</a>
          <a routerLink="/search" class="btn-secondary px-6 py-3 text-sm min-h-[44px]">Explorar</a>
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
