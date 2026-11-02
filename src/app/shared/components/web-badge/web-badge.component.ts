import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/** Always the real site: a badge copied from a preview must not link to the preview. */
const SITE = 'https://www.bandyou.es';

/** The HTML someone pastes in their own web to link to their BandYou profile. */
export function webBadgeSnippet(path: string): string {
  return `<a href="${SITE}${path}"><img src="${SITE}/badge-bandyou.png" alt="Encuéntranos en BandYou" width="180" height="48"></a>`;
}

/** "Botón para tu web", in the panel: a link from a band's own site helps both of us. */
@Component({
  selector: 'app-web-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="card-flat p-4 sm:p-5 mb-6">
      <summary class="cursor-pointer min-h-[28px] font-mono text-xs font-bold uppercase tracking-wide text-ink">Botón para tu web</summary>
      <p class="text-sm text-ink-muted mt-3 mb-3">¿Tienes web? Pega este código donde quieras que salga el botón. Enlaza a tu perfil, para que te encuentren aquí.</p>
      <img src="/badge-bandyou.png" alt="Encuéntranos en BandYou" width="180" height="48" loading="lazy" class="mb-3"/>
      <code class="block bg-dark-900 border border-ink/15 p-3 text-xs text-ink break-all mb-3">{{ snippet() }}</code>
      <button type="button" (click)="copy()" class="btn-secondary min-h-[44px] text-xs">{{ copied() ? 'Código copiado' : 'Copiar código' }}</button>
      <span class="sr-only" role="status">{{ copied() ? 'Código del botón copiado al portapapeles' : '' }}</span>
    </details>
  `,
})
export class WebBadgeComponent {
  private toast = inject(ToastService);

  /** Public profile path, e.g. /bands/123. */
  readonly path = input.required<string>();
  readonly snippet = computed(() => webBadgeSnippet(this.path()));
  readonly copied = signal(false);

  async copy() {
    try {
      await navigator.clipboard.writeText(this.snippet());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.error('No se pudo copiar. Selecciona el código y cópialo a mano.');
    }
  }
}
