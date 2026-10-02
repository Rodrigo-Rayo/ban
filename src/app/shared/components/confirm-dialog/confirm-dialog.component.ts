import { Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Single confirmation dialog for the whole app (see ConfirmService). */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (svc.pending(); as p) {
      <div class="fixed inset-0 z-[80] bg-ink/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
           (click)="svc.settle(false)">
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
             [attr.aria-describedby]="p.message ? 'confirm-msg' : null"
             class="w-full sm:max-w-md bg-dark-900 border-t-2 sm:border-2 border-ink sm:shadow-[8px_8px_0_0_#141210] p-6 safe-area-pb animate-slide-in"
             (click)="$event.stopPropagation()">
          <h2 id="confirm-title" class="text-3xl leading-[1.05]">{{ p.title }}</h2>
          @if (p.message) {
            <p id="confirm-msg" class="text-sm text-ink-muted mt-2 leading-relaxed">{{ p.message }}</p>
          }
          <div class="mt-6 grid grid-cols-2 gap-2">
            <button type="button" class="btn-secondary" (click)="svc.settle(false)">{{ p.cancelLabel }}</button>
            <button #confirmBtn type="button" [class]="p.danger ? 'btn-primary' : 'btn-night'" (click)="svc.settle(true)">
              {{ p.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly svc = inject(ConfirmService);
  private confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');
  private returnFocus: HTMLElement | null = null;

  constructor() {
    // Focus the dialog's action when it opens; give focus back when it closes.
    effect(() => {
      const open = !!this.svc.pending();
      const btn = this.confirmBtn();
      if (open && btn) {
        this.returnFocus ??= document.activeElement as HTMLElement | null;
        queueMicrotask(() => btn.nativeElement.focus());
      } else if (!open && this.returnFocus) {
        this.returnFocus.focus?.();
        this.returnFocus = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.svc.settle(false); }
}
