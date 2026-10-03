import { Component, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';
import { anyBannerVisible } from '../cookie-banner/banner-queue';

@Component({
    selector: 'app-toast',
    imports: [IconComponent],
    template: `
    <div class="fixed bottom-above-nav left-4 right-4 sm:left-auto sm:w-[340px] z-[60] flex flex-col gap-2 pointer-events-none"
         [class]="bannerUp() ? 'mb-28' : 'mb-3 lg:mb-6'"
         role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div
          class="flex items-start gap-3 px-4 py-3 border-2 border-ink text-sm font-semibold pointer-events-auto animate-slide-up"
          [class]="toastClasses[toast.type]">
          <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center border-[1.5px] border-ink font-mono text-xs font-bold" [class]="toastIconClasses[toast.type]" aria-hidden="true"><app-icon [name]="toastIcon[toast.type]" [size]="14" [strokeWidth]="2.5"/></span>
          <span class="flex-1 leading-snug">@if (toast.type === 'error') {<span class="sr-only">Error: </span>}{{ toast.message }}</span>
          <button type="button" (click)="toastSvc.dismiss(toast.id)"
            class="flex-shrink-0 min-w-[44px] min-h-[44px] -my-3 -mr-4 flex items-center justify-center text-ink hover:text-primary-500 transition-colors text-xs font-bold"
            aria-label="Cerrar notificación"><app-icon name="x" [size]="14" [strokeWidth]="2.5"/></button>
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
  /** A bottom notice is showing: toasts sit above it instead of covering it. */
  readonly bannerUp = anyBannerVisible;

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
    success: 'check',
    error:   'x',
    info:    'info',
  };
}
