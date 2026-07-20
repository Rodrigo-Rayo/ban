import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none" style="max-width:340px"
         aria-live="polite" aria-atomic="false">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div
          class="flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium pointer-events-auto animate-slide-up"
          [class]="toastClasses[toast.type]"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'">
          <span class="text-base flex-shrink-0 mt-0.5" aria-hidden="true">{{ toastIcon[toast.type] }}</span>
          <span class="flex-1 leading-snug">{{ toast.message }}</span>
          <button (click)="toastSvc.dismiss(toast.id)"
            class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs font-bold ml-1"
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
  `],
})
export class ToastComponent {
  toastSvc = inject(ToastService);

  readonly toastClasses = {
    success: 'bg-dark-800 border-signal-green/40 text-ink',
    error:   'bg-dark-800 border-signal-red/40 text-ink',
    info:    'bg-dark-800 border-primary-500/40 text-ink',
  };

  readonly toastIcon = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };
}
