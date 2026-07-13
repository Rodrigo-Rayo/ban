import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private zone = inject(NgZone);
  private toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    const message = this.extractMessage(error);

    // Ignore chunk load errors from lazy routes (network blip, user retries naturally)
    if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) return;

    this.zone.run(() => {
      this.toast.error('Algo ha salido mal. Por favor, recarga la página.');
    });
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return '';
  }
}
