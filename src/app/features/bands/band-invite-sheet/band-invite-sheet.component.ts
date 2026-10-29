import { ChangeDetectionStrategy, Component, ElementRef, HostListener, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { inviteMessage, whatsappUrl } from '../../../core/services/band-invites.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * "Invitar a Carlos": the band sends a line-up member their personal link,
 * by WhatsApp first, or copied / shared with any other app.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-band-invite-sheet',
  template: `
    <div class="fixed inset-0 z-[80] bg-ink/60" (click)="close()" aria-hidden="true"></div>
    <div class="fixed z-[81] inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[30rem] sm:bottom-6 bg-dark-900 text-ink border-t-2 sm:border-2 border-ink shadow-[0_-4px_0_0_#141210] sm:shadow-[6px_6px_0_0_#141210] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
         role="dialog" aria-modal="true" aria-labelledby="invite-title" tabindex="-1">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-primary-500">Invitar a la formación</p>
          <h2 id="invite-title" class="font-display text-3xl uppercase leading-none mt-1 break-words">{{ memberName() || 'Integrante' }}</h2>
        </div>
        <button type="button" (click)="close()" class="w-11 h-11 shrink-0 flex items-center justify-center border-2 border-ink" aria-label="Cerrar">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <p class="mt-3 text-sm">Le llega un enlace personal. Con él <strong>crea su perfil de músico</strong> (gratis) y queda unido a
        {{ bandName() }}: saldrá en la formación con su foto y su perfil. Si ya tiene perfil de músico, solo tendrá que aceptar.</p>

      <figure class="mt-3 border-l-4 border-poster-yellow bg-white px-3 py-2">
        <figcaption class="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted">Mensaje</figcaption>
        <p class="text-sm mt-1 [overflow-wrap:anywhere]">{{ message() }}</p>
      </figure>

      <div class="mt-4 flex flex-col gap-2">
        <a [href]="whatsapp()" target="_blank" rel="noopener noreferrer" (click)="sent()"
           class="btn-primary min-h-[52px] text-base">Enviar por WhatsApp<span class="sr-only"> (se abre en una pestaña nueva)</span></a>
        <div class="grid gap-2" [class.grid-cols-2]="canShare">
          <button type="button" (click)="copy()" class="btn-secondary min-h-[48px]">{{ copied() ? '¡Copiado!' : 'Copiar mensaje' }}</button>
          @if (canShare) {
            <button type="button" (click)="share()" class="btn-secondary min-h-[48px]">Otras apps</button>
          }
        </div>
      </div>
      <p class="mt-3 text-xs text-ink-muted">El enlace vale para una sola persona y caduca en 14 días.</p>
    </div>
  `,
})
export class BandInviteSheetComponent {
  private toast = inject(ToastService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Focus moves into the sheet (Escape and Tab work straight away) and back when it closes. */
  private readonly opener = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[role=dialog]')?.focus());
  }

  @HostListener('document:keydown.escape')
  close() {
    this.closed.emit();
    this.opener?.focus?.();
  }
  /** Tab / Shift+Tab cycle inside the sheet while it is open. */
  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  onTab(event: Event) {
    const items = [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role=dialog] a[href], [role=dialog] button')];
    if (!items.length) return;
    event.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const back = (event as KeyboardEvent).shiftKey;
    const next = i === -1 ? (back ? items.length - 1 : 0) : (i + (back ? -1 : 1) + items.length) % items.length;
    items[next].focus();
  }

  readonly bandName = input.required<string>();
  readonly memberName = input<string>('');
  readonly instrument = input<string | null>(null);
  readonly url = input.required<string>();
  readonly closed = output<void>();

  readonly copied = signal(false);
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  readonly message = computed(() => inviteMessage(this.bandName(), this.memberName(), this.instrument(), this.url()));
  readonly whatsapp = computed(() => whatsappUrl(this.message()));

  sent() {
    this.toast.success('Cuando acepte, te llegará un aviso.');
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.message());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.error('No se pudo copiar. Mantén pulsado el mensaje para copiarlo.');
    }
  }

  async share() {
    await navigator.share({ title: `Únete a ${this.bandName()} en BandYou`, text: this.message() }).catch(() => undefined);
  }
}
