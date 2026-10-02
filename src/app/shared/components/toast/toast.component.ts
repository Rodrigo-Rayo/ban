import { Component, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-toast',
    imports: [],
    template: `
    <div class="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none" style="max-width:340px"
         role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div
          class="flex items-start gap-3 px-4 py-3 border-2 border-ink text-sm font-semibold pointer-events-auto animate-slide-up"
          [class]="toastClasses[toast.type]">
          <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center border-[1.5px] border-ink font-mono text-xs font-bold" [class]="toastIconClasses[toast.type]" aria-hidden="true">{{ toastIcon[toast.type] }}</span>
          <span class="flex-1 leading-snug">@if (toast.type === 'error') {<span class="sr-only">Error: </span>}{{ toast.message }}</span>
          <button type="button" (click)="toastSvc.dismiss(toast.id)"
            class="flex-shrink-0 min-w-[44px] min-h-[44px] -my-3 -mr-4 flex items-center justify-center text-ink hover:text-primary-500 transition-colors text-xs font-bold"
            aria-label="Cerrar notificación">✕</button>
        </div>
      }
    </div>
  `,
    styles: [`
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-up { animation: slide-up 0.22s ease-out both; }
  `]
})
export class ToastComponent {
  toastSvc = inject(ToastService);

  readonly toastClasses = {
    success: 'bg-dark-800 text-ink shadow-[4px_4px_0_0_#1d6b3a]',
    error:   'bg-dark-800 text-ink shadow-[4px_4px_0_0_#b3261e]',
    info:    'bg-dark-800 text-ink shadow-[4px_4px_0_0_#141210]',
  };

  readonly toastIconClasses = {
    success: 'bg-signal-gBg text-signal-green',
    error:   'bg-signal-rBg text-signal-red',
    info:    'bg-poster-yellow text-ink',
  };

  readonly toastIcon = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };
}
