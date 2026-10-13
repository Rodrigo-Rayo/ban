import { Component, computed, inject, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { PUBLISH_CONTENT, PublishOption, bandVacancyOption } from '../navbar/navbar.component';

/**
 * "Publicar" as a bottom sheet (home circles, Escaparate): the same choices as the
 * site's Publicar button, or sign-in / sign-up for visitors.
 */
@Component({
  selector: 'app-publish-sheet',
  imports: [RouterLink, IconComponent],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[80] bg-ink/60" (click)="open.set(false)" aria-hidden="true"></div>
      <div class="fixed z-[81] inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[30rem] sm:bottom-6 bg-dark-900 text-ink border-t-2 sm:border-2 border-ink shadow-[0_-4px_0_0_#141210] sm:shadow-[6px_6px_0_0_#141210] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
           role="dialog" aria-modal="true" aria-label="Publicar" (keydown.escape)="open.set(false)">
        <div class="flex items-center justify-between mb-3">
          <p class="font-display text-3xl uppercase leading-none">Publicar</p>
          <button type="button" (click)="open.set(false)" class="w-11 h-11 flex items-center justify-center border-2 border-ink" aria-label="Cerrar">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        @if (auth.isLoggedIn()) {
          <ul class="flex flex-col gap-2">
            @for (o of items(); track o.label) {
              <li>
                <a [routerLink]="o.link" [queryParams]="o.query ?? null" (click)="open.set(false)"
                   class="flex items-center gap-3 border-2 border-ink px-3 py-2.5 min-h-[56px] hover:bg-poster-yellow transition-colors">
                  <span class="w-9 h-9 flex-shrink-0 border-2 border-ink bg-dark-800 flex items-center justify-center"><app-icon [name]="o.icon" [size]="16"/></span>
                  <span class="min-w-0">
                    <span class="block font-bold text-sm">{{ o.label }}</span>
                    <span class="block text-xs text-ink-muted">{{ o.hint }}</span>
                  </span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="text-sm mb-3">Crea tu perfil gratis para publicar anuncios, conciertos y equipo.</p>
          <div class="grid grid-cols-2 gap-2">
            <a routerLink="/auth/login" (click)="open.set(false)" class="btn-secondary min-h-[48px]">Entrar</a>
            <a routerLink="/auth/register" (click)="open.set(false)" class="btn-primary min-h-[48px]">Crear perfil</a>
          </div>
        }
      </div>
    }
  `,
})
export class PublishSheetComponent {
  readonly auth = inject(AuthService);
  readonly open = model(false);
  /** Same choices as the "Publicar" button of the site (plus the band vacancy for bands). */
  readonly items = computed<readonly PublishOption[]>(() => {
    const vacancy = bandVacancyOption(this.auth.userProfileType(), this.auth.userProfileData()?.id);
    return vacancy ? [...PUBLISH_CONTENT, vacancy] : PUBLISH_CONTENT;
  });
}
