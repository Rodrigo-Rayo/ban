import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-dark-900" style="padding-top:64px; padding-bottom:80px">
      <div class="max-w-3xl mx-auto px-5 lg:px-8 py-10">

        <a routerLink="/" class="inline-flex items-center gap-2 text-xs text-ink-muted hover:text-ink mb-8 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Volver al inicio
        </a>

        <div class="mb-10">
          <p class="text-xs font-bold text-primary-500 uppercase tracking-widest mb-2">Legal</p>
          <h1 class="text-3xl font-black text-ink tracking-tight mb-3">Política de Cookies</h1>
          <p class="text-sm text-ink-muted">Última actualización: 13 de julio de 2026</p>
        </div>

        <div class="prose-legal">

          <section>
            <h2>¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que un sitio web guarda en tu dispositivo
              cuando lo visitas. Permiten que el sitio recuerde tus preferencias y estado de sesión.
            </p>
          </section>

          <section>
            <h2>Cookies que usamos</h2>
            <p>BandYou usa <strong>únicamente cookies técnicas esenciales</strong>:</p>
            <div class="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Proveedor</th>
                    <th>Finalidad</th>
                    <th>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>sb-*-auth-token</code></td>
                    <td>Supabase</td>
                    <td>Mantener la sesión de usuario autenticado</td>
                    <td>7 días</td>
                  </tr>
                  <tr>
                    <td><code>bandyou_cookie_consent</code></td>
                    <td>BandYou</td>
                    <td>Guardar tu preferencia de consentimiento de cookies</td>
                    <td>1 año</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              No usamos cookies de publicidad, rastreo ni analítica de terceros.
            </p>
          </section>

          <section>
            <h2>Cómo gestionar las cookies</h2>
            <p>
              Puedes configurar tu navegador para rechazar o eliminar cookies en cualquier momento.
              Ten en cuenta que desactivar las cookies técnicas puede impedir el funcionamiento
              correcto de la sesión.
            </p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener">Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Edge</a></li>
            </ul>
          </section>

          <section>
            <h2>Contacto</h2>
            <p>
              Para dudas sobre el uso de cookies: <a href="mailto:privacidad@bandyou.es">privacidad&#64;bandyou.es</a>
            </p>
          </section>

        </div>

        <div class="mt-12 pt-8 border-t border-dark-600 flex flex-wrap gap-4">
          <a routerLink="/legal/privacidad" class="text-sm text-primary-500 hover:underline font-medium">Política de Privacidad</a>
          <a routerLink="/legal/terminos" class="text-sm text-primary-500 hover:underline font-medium">Términos de Uso</a>
        </div>

      </div>
    </div>
  `,
})
export class CookiesComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit() {
    this.seo.set({
      title: 'Política de Cookies',
      description: 'Política de cookies de BandYou. Solo usamos cookies técnicas esenciales para el funcionamiento de la sesión.',
      url: 'https://bandyou.es/legal/cookies',
    });
  }
}
