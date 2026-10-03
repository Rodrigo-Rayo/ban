import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LEGAL_INFO } from '../../../features/legal/legal-info';

/**
 * "Denunciar" link (DSA notice-and-action): opens a pre-filled email to the legal
 * mailbox with the address of the content being reported.
 */
@Component({
  selector: 'app-report-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="href()" class="inline-flex items-center min-h-[44px] font-mono text-[11px] font-bold uppercase tracking-wide text-ink-muted underline hover:text-primary-600">
      Denunciar {{ what() }}
    </a>
  `,
})
export class ReportLinkComponent {
  /** What is being reported, as it reads after "Denunciar": "este perfil", "este anuncio"… */
  readonly what = input('este contenido');

  readonly href = computed(() => reportMailto(this.what(), typeof location !== 'undefined' ? location.href : ''));
}

export function reportMailto(what: string, url: string): string {
  const subject = `Denuncia: ${what}`;
  const body = `Quiero denunciar ${what}:\n${url}\n\nMotivo:\n`;
  return `mailto:${LEGAL_INFO.legalEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
