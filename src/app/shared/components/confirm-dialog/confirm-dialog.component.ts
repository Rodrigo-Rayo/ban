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
            <button #cancelBtn type="button" class="btn-secondary" (click)="svc.settle(false)">{{ p.cancelLabel }}</button>
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
  private cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');
  private returnFocus: HTMLElement | null = null;

  constructor() {
    // Focus goes into the dialog when it opens — on "Cancelar" for destructive
    // actions, so a double Enter never deletes anything — and back when it closes.
    effect(() => {
      const p = this.svc.pending();
      const target = p?.danger ? this.cancelBtn() : this.confirmBtn();
      if (p && target) {
        this.returnFocus ??= document.activeElement as HTMLElement | null;
        queueMicrotask(() => target.nativeElement.focus());
      } else if (!p && this.returnFocus) {
        this.returnFocus.focus?.();
        this.returnFocus = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.svc.pending()) this.svc.settle(false);
  }

  /** Keeps Tab / Shift+Tab cycling between the two buttons while the dialog is open. */
  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  onTab(event: Event) {
    if (!this.svc.pending()) return;
    const buttons = [this.cancelBtn()?.nativeElement, this.confirmBtn()?.nativeElement].filter(Boolean) as HTMLElement[];
    if (!buttons.length) return;
    event.preventDefault();
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const back = (event as KeyboardEvent).shiftKey;
    buttons[(i + (back ? -1 : 1) + buttons.length) % buttons.length].focus();
  }
}
