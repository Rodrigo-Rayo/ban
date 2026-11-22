import { InjectionToken, computed, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';

/**
 * Cloudflare Turnstile site key. Empty string = captcha off: no widget is
 * rendered, the script is never requested and auth calls carry no token.
 */
export const TURNSTILE_SITE_KEY = new InjectionToken<string>('TURNSTILE_SITE_KEY', {
  providedIn: 'root',
  factory: () => environment.turnstileSiteKey ?? '',
});

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_TIMEOUT_MS = 15_000;

export const CAPTCHA_FAILED_MESSAGE = 'No hemos podido comprobar que no eres un robot. Inténtalo de nuevo.';
export const CAPTCHA_LOAD_MESSAGE =
  'No se ha podido cargar la comprobación anti-robots. Revisa tu conexión o desactiva el bloqueador y vuelve a intentarlo.';

/** Minimal slice of the window.turnstile API that we use. */
export interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Loads api.js once per page. A failed load can be retried. */
export function loadTurnstile(doc: Document = document): Promise<TurnstileApi> {
  const win = doc.defaultView as (Window & { turnstile?: TurnstileApi }) | null;
  if (win?.turnstile) return Promise.resolve(win.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = doc.createElement('script');
    const fail = (reason: string) => {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail('turnstile_timeout'), SCRIPT_TIMEOUT_MS);
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (win?.turnstile) resolve(win.turnstile);
      else fail('turnstile_missing');
    };
    script.onerror = () => fail('turnstile_load_error');
    doc.head.appendChild(script);
  });
  return scriptPromise;
}

/** True when Supabase Auth rejected the request because of the captcha. */
export function isCaptchaError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'captcha_failed' || /captcha/i.test(err?.message ?? '');
}

/**
 * Per-form captcha state. With no site key, `pending` is always false and
 * `take()` always returns undefined, so forms behave exactly as before.
 */
export class CaptchaGate {
  readonly token = signal<string | null>(null);
  readonly failed = signal(false);
  /** Submit should wait: captcha on, no token yet, and the widget hasn't given up. */
  readonly pending = computed(() => this.enabled && !this.token() && !this.failed());

  constructor(readonly enabled: boolean) {}

  onToken(token: string | null) {
    this.token.set(token);
    if (token) this.failed.set(false);
  }

  onFailed() {
    this.token.set(null);
    this.failed.set(true);
  }

  /** Token for the next auth call. Tokens are single-use, so it is cleared. */
  take(): string | undefined {
    const t = this.token() ?? undefined;
    this.token.set(null);
    return t;
  }
}

export function injectCaptchaGate(): CaptchaGate {
  return new CaptchaGate(!!inject(TURNSTILE_SITE_KEY));
}

/** `{ captchaToken }` when there is a token, `{}` otherwise. */
export function captchaOption(token?: string | null): { captchaToken?: string } {
  return token ? { captchaToken: token } : {};
}
