import { AfterViewInit, Component, DOCUMENT, ElementRef, OnDestroy, inject, input, output, signal, viewChild } from '@angular/core';
import { CAPTCHA_FAILED_MESSAGE, CAPTCHA_LOAD_MESSAGE, TURNSTILE_SITE_KEY, TurnstileApi, loadTurnstile } from './turnstile';

/**
 * Cloudflare Turnstile widget for auth forms. Renders nothing and loads no
 * script while TURNSTILE_SITE_KEY is empty. With 'interaction-only' most
 * people never see it; it only shows a checkbox when Cloudflare is unsure.
 */
@Component({
  selector: 'app-turnstile',
  host: { '[style.display]': 'siteKey ? "block" : "none"' },
  template: `
    @if (siteKey) {
      <div #box></div>
      @if (problem()) {
        <p role="alert" class="text-xs font-bold text-signal-red mt-1">
          {{ problem() }}
          <button type="button" (click)="retry()" class="underline font-semibold ml-1">Reintentar</button>
        </p>
      }
    }
  `,
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  readonly siteKey = inject(TURNSTILE_SITE_KEY);
  private doc = inject(DOCUMENT);

  /** Label shown in Cloudflare analytics (a-z, 0-9, - and _ only). */
  action = input<string>();
  /** New token, or null when it expired / was used / errored. */
  token = output<string | null>();
  /** The widget could not run (script blocked, network, Cloudflare error). */
  failed = output<void>();

  problem = signal('');
  private box = viewChild<ElementRef<HTMLElement>>('box');
  private api: TurnstileApi | null = null;
  private widgetId: string | undefined;
  private destroyed = false;

  ngAfterViewInit() {
    if (this.siteKey) void this.mount();
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.api && this.widgetId) this.api.remove(this.widgetId);
  }

  /** Get a fresh token (call after each auth request: tokens are single-use). */
  reset() {
    if (!this.api || !this.widgetId) return;
    this.token.emit(null);
    this.api.reset(this.widgetId);
  }

  retry() {
    this.problem.set('');
    if (this.api && this.widgetId) this.reset();
    else void this.mount();
  }

  private async mount() {
    const box = this.box()?.nativeElement;
    if (!box) return;
    try {
      this.api = await loadTurnstile(this.doc);
    } catch {
      this.fail(CAPTCHA_LOAD_MESSAGE);
      return;
    }
    if (this.destroyed) return;
    this.widgetId = this.api.render(box, {
      sitekey: this.siteKey,
      action: this.action(),
      appearance: 'interaction-only',
      language: 'es',
      'refresh-expired': 'auto',
      callback: (t: string) => { this.problem.set(''); this.token.emit(t); },
      'expired-callback': () => this.token.emit(null),
      'error-callback': () => { this.fail(CAPTCHA_FAILED_MESSAGE); return true; },
      'unsupported-callback': () => this.fail(CAPTCHA_FAILED_MESSAGE),
    });
  }

  private fail(message: string) {
    this.problem.set(message);
    this.token.emit(null);
    this.failed.emit();
  }
}
