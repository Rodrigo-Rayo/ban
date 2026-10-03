import { Component } from '@angular/core';

/** Yellow poster panel shared by the auth pages (desktop only, decorative). */
@Component({
  selector: 'app-auth-poster',
  template: `
    <aside class="hidden lg:flex lg:w-[440px] flex-shrink-0 bg-poster-yellow border-l-2 border-ink flex-col justify-end p-10" aria-hidden="true">
      <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink mb-3">La red musical de España</p>
      <p class="font-display text-7xl uppercase leading-[1.05] text-ink">Músicos,<br>bandas,<br>salas.</p>
      <p class="mt-6 border-t-2 border-ink pt-3 font-mono text-[11px] font-bold uppercase tracking-wide text-ink">Se busca · Agenda · Tienda · Perfil gratis</p>
    </aside>
  `,
})
export class AuthPosterComponent {}
