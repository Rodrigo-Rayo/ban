import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming button, e.g. "Eliminar". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action: the confirm button is red. */
  danger?: boolean;
}

interface PendingConfirm extends Required<Omit<ConfirmOptions, 'message'>> {
  message: string;
  resolve: (ok: boolean) => void;
}

/**
 * Poster-style replacement for window.confirm(): `await confirm.ask({...})`.
 * Rendered once by <app-confirm-dialog> in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A new question replaces (cancels) any open one.
    this.pending()?.resolve(false);
    return new Promise<boolean>(resolve => {
      this.pending.set({
        title: options.title,
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? 'Aceptar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        resolve,
      });
    });
  }

  settle(ok: boolean) {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(ok);
  }
}
