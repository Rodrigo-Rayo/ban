import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private zone = inject(NgZone);
  private toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    const message = this.extractMessage(error);

    // A lazy route failed to load — usually a new version was deployed while this
    // tab was open, so its old file names no longer exist. Reload once to pick up
    // the new version (guarded so a real outage cannot cause a reload loop).
    if (isChunkLoadError(message)) {
      reloadOnce();
      return;
    }

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

const CHUNK_ERROR = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i;
const RELOAD_KEY = 'bandyou_chunk_reload_at';

export function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR.test(message);
}

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: still try once */ }
  location.reload();
}
