import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { LEGAL_INFO } from '../legal-info';

interface StorageItem {
  name: string;
  type: string;
  provider: string;
  purpose: string;
  duration: string;
}

/** Inventory of every client-side storage item the app writes (keep in sync with the code). */
const STORAGE_ITEMS: readonly StorageItem[] = [
  { name: 'sb-…-auth-token', type: 'localStorage', provider: 'BandYou (Supabase)', purpose: 'Mantener tu sesión iniciada de forma segura', duration: 'Hasta que cierres sesión' },
  { name: 'sb-…-code-verifier', type: 'localStorage', provider: 'BandYou (Supabase)', purpose: 'Completar de forma segura el inicio de sesión con Google o con un enlace de email', duration: 'Hasta terminar el inicio de sesión' },
  { name: 'bandyou_consent_pending', type: 'sessionStorage', provider: 'BandYou', purpose: 'Recordar que aceptaste las condiciones al registrarte hasta que termines de crear tu perfil', duration: 'Hasta cerrar la pestaña' },
  { name: 'bandyou_return_url', type: 'sessionStorage', provider: 'BandYou', purpose: 'Volver a la página en la que estabas tras iniciar sesión', duration: 'Hasta cerrar la pestaña' },
  { name: 'bandyou_role', type: 'localStorage', provider: 'BandYou', purpose: 'Recordar el tipo de perfil que eliges al registrarte', duration: 'Hasta que lo borres' },
  { name: 'bandyou_profile_type, bandyou_city', type: 'localStorage', provider: 'BandYou', purpose: 'Recordar tu tipo de perfil y tu ciudad para mostrarte contenido cercano', duration: 'Hasta que lo borres' },
  { name: 'bandyou_cookie_consent', type: 'localStorage', provider: 'BandYou', purpose: 'Recordar que ya has visto el aviso de cookies', duration: 'Hasta que lo borres' },
  { name: 'pwa-install-dismissed, notif-permission-dismissed, bandyou_push_notice_dismissed', type: 'localStorage', provider: 'BandYou', purpose: 'No volver a mostrarte avisos que ya has cerrado (instalar la app, activar notificaciones)', duration: 'Hasta que lo borres' },
  { name: 'ngsw:*', type: 'Cache Storage (service worker)', provider: 'BandYou', purpose: 'Guardar los archivos de la aplicación para que cargue más rápido y funcione como app instalable. No contiene datos personales', duration: 'Hasta la siguiente actualización de la app' },
];

@Component({
    selector: 'app-cookies',
    imports: [RouterLink],
    template: `
    <div class="min-h-screen bg-dark-900 pt-16 pb-20">
  <header class="page-head">
    <div class="page-head-inner max-w-3xl">
      <div>
        <p class="page-kicker">Legal</p>
        <h1 class="page-title">Política de Cookies</h1>
      </div>
      <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-muted text-right">Última actualización: {{ info.updated }}</p>
    </div>
  </header>
  <div class="page-wrap max-w-3xl py-6">
    <a routerLink="/" class="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wide text-ink hover:text-primary-600 mb-4 min-h-[44px] transition-colors">
          <svg aria-hidden="true" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Volver al inicio
        </a>


        <div class="prose-legal">

          <section>
            <h2>¿Qué son las cookies y tecnologías similares?</h2>
            <p>
              Las cookies son pequeños archivos que un sitio web guarda en tu dispositivo. El artículo 22.2 de la
              LSSI-CE se aplica también a tecnologías similares, como el almacenamiento local del navegador
              (<code>localStorage</code> y <code>sessionStorage</code>) o la caché de un service worker.
              BandYou no usa cookies propiamente dichas: usa almacenamiento local del navegador.
            </p>
          </section>

          <section>
            <h2>Qué usamos y por qué no pedimos consentimiento</h2>
            <p>
              Todo el almacenamiento que usa BandYou es <strong>estrictamente necesario</strong> para prestar el
              servicio que solicitas (mantener tu sesión, completar el inicio de sesión, recordar las preferencias
              que eliges) y, según la LSSI-CE y la Guía sobre el uso de cookies de la AEPD, está
              <strong>exento de consentimiento</strong>. Por eso solo te mostramos un aviso informativo y no un
              botón de aceptar o rechazar. No usamos cookies ni almacenamiento de publicidad, analítica, redes
              sociales o seguimiento, propios ni de terceros.
            </p>
            <div class="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Titular</th>
                    <th>Finalidad</th>
                    <th>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items; track item.name) {
                    <tr>
                      <td><code>{{ item.name }}</code></td>
                      <td>{{ item.type }}</td>
                      <td>{{ item.provider }}</td>
                      <td>{{ item.purpose }}</td>
                      <td>{{ item.duration }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>Servicios de terceros que se cargan en la web</h2>
            <ul>
              <li>
                <strong>Tipografías:</strong> se sirven desde nuestros propios servidores; no se contacta con Google Fonts.
              </li>
              <li>
                <strong>Inicio de sesión con Google:</strong> solo si eliges "Continuar con Google", se te redirige a
                Google, que puede usar sus propias cookies conforme a su política.
              </li>
              <li>
                <strong>Imágenes y enlaces externos:</strong> algunas fotos de perfil (por ejemplo, la de tu cuenta de
                Google) se cargan desde servidores de terceros, que reciben tu dirección IP al mostrarlas.
              </li>
            </ul>
          </section>

          <section>
            <h2>Cómo borrar o bloquear este almacenamiento</h2>
            <p>
              Puedes borrar el almacenamiento local de BandYou en cualquier momento desde la configuración de tu
              navegador (datos de sitios). Al cerrar sesión se elimina el token de sesión. Si bloqueas el
              almacenamiento local, no podrás iniciar sesión.
            </p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener">Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Edge</a></li>
            </ul>
          </section>

          <section>
            <h2>Cambios</h2>
            <p>
              Si en el futuro incorporamos cookies o almacenamiento que requieran tu consentimiento (por ejemplo, de
              analítica), te lo pediremos antes de usarlos, con opciones para aceptar, rechazar o configurar con la
              misma facilidad.
            </p>
          </section>

          <section>
            <h2>Contacto</h2>
            <p>
              Para dudas sobre esta política: <a [href]="'mailto:' + info.privacyEmail">{{ info.privacyEmail }}</a>.
              Titular: {{ info.ownerName }} — más datos en el <a routerLink="/legal/aviso-legal">Aviso Legal</a>.
            </p>
          </section>

        </div>

        <div class="mt-12 pt-8 border-t border-dark-600 flex flex-wrap gap-4">
          <a routerLink="/legal/aviso-legal" class="text-sm text-primary-500 hover:underline font-medium">Aviso legal</a>
          <a routerLink="/legal/privacidad" class="text-sm text-primary-500 hover:underline font-medium">Política de Privacidad</a>
          <a routerLink="/legal/terminos" class="text-sm text-primary-500 hover:underline font-medium">Términos de Uso</a>
        </div>

      </div>
    </div>
  `
})
export class CookiesComponent implements OnInit {
  private seo = inject(SeoService);

  readonly info = LEGAL_INFO;
  readonly items = STORAGE_ITEMS;

  ngOnInit() {
    this.seo.set({
      title: 'Política de Cookies',
      description: 'Política de cookies de BandYou. Solo usamos almacenamiento técnico necesario para la sesión y tus preferencias, sin publicidad ni analítica.',
      url: 'https://www.bandyou.es/legal/cookies',
    });
  }
}
