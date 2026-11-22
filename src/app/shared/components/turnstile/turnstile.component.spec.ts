import { TestBed } from '@angular/core/testing';
import { TurnstileComponent } from './turnstile.component';
import { CaptchaGate, TURNSTILE_SITE_KEY, TurnstileApi, captchaOption, isCaptchaError } from './turnstile';

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

function scriptTags(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]'));
}

describe('TurnstileComponent', () => {
  afterEach(() => {
    scriptTags().forEach(s => s.remove());
    delete (window as TurnstileWindow).turnstile;
  });

  describe('with no site key (feature off)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [TurnstileComponent],
        providers: [{ provide: TURNSTILE_SITE_KEY, useValue: '' }],
      });
    });

    it('renders nothing, hides its host and loads no script', () => {
      const fixture = TestBed.createComponent(TurnstileComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.children.length).toBe(0);
      expect(host.style.display).toBe('none');
      expect(scriptTags().length).toBe(0);
    });

    it('reset() is a harmless no-op', () => {
      const fixture = TestBed.createComponent(TurnstileComponent);
      fixture.detectChanges();
      expect(() => fixture.componentInstance.reset()).not.toThrow();
    });
  });

  describe('with a site key', () => {
    let api: jasmine.SpyObj<TurnstileApi>;
    let renderOptions: Record<string, (...a: unknown[]) => unknown>;

    beforeEach(() => {
      api = jasmine.createSpyObj<TurnstileApi>('turnstile', ['render', 'reset', 'remove']);
      api.render.and.callFake((_el, opts) => { renderOptions = opts as typeof renderOptions; return 'w1'; });
      (window as TurnstileWindow).turnstile = api; // pretend api.js is already loaded
      TestBed.configureTestingModule({
        imports: [TurnstileComponent],
        providers: [{ provide: TURNSTILE_SITE_KEY, useValue: 'site-key' }],
      });
    });

    it('renders the widget invisibly and emits tokens', async () => {
      const fixture = TestBed.createComponent(TurnstileComponent);
      const tokens: (string | null)[] = [];
      fixture.componentInstance.token.subscribe(t => tokens.push(t));
      fixture.componentRef.setInput('action', 'login');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(api.render).toHaveBeenCalledTimes(1);
      expect(renderOptions['sitekey'] as unknown).toBe('site-key');
      expect(renderOptions['appearance'] as unknown).toBe('interaction-only');
      expect(renderOptions['action'] as unknown).toBe('login');

      renderOptions['callback']('tok');
      renderOptions['expired-callback']();
      expect(tokens).toEqual(['tok', null]);
    });

    it('shows a Spanish message and emits failed on widget error', async () => {
      const fixture = TestBed.createComponent(TurnstileComponent);
      let failed = 0;
      fixture.componentInstance.failed.subscribe(() => failed++);
      fixture.detectChanges();
      await fixture.whenStable();

      renderOptions['error-callback']();
      fixture.detectChanges();
      expect(failed).toBe(1);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('no eres un robot');
    });

    it('reset() and destroy talk to the widget', async () => {
      const fixture = TestBed.createComponent(TurnstileComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentInstance.reset();
      expect(api.reset).toHaveBeenCalledWith('w1');
      fixture.destroy();
      expect(api.remove).toHaveBeenCalledWith('w1');
    });
  });
});

describe('turnstile helpers', () => {
  it('CaptchaGate is never pending when disabled', () => {
    const gate = new CaptchaGate(false);
    expect(gate.pending()).toBeFalse();
    expect(gate.take()).toBeUndefined();
  });

  it('CaptchaGate waits for a token, then hands it out once', () => {
    const gate = new CaptchaGate(true);
    expect(gate.pending()).toBeTrue();
    gate.onToken('t');
    expect(gate.pending()).toBeFalse();
    expect(gate.take()).toBe('t');
    expect(gate.take()).toBeUndefined();
    expect(gate.pending()).toBeTrue();
  });

  it('CaptchaGate stops blocking once the widget fails', () => {
    const gate = new CaptchaGate(true);
    gate.onFailed();
    expect(gate.pending()).toBeFalse();
  });

  it('captchaOption only includes a real token', () => {
    expect(captchaOption('t')).toEqual({ captchaToken: 't' });
    expect(captchaOption(undefined)).toEqual({});
    expect(captchaOption(null)).toEqual({});
  });

  it('isCaptchaError recognises Supabase captcha rejections', () => {
    expect(isCaptchaError({ code: 'captcha_failed' })).toBeTrue();
    expect(isCaptchaError({ message: 'captcha protection: request disallowed (no captcha response)' })).toBeTrue();
    expect(isCaptchaError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBeFalse();
    expect(isCaptchaError(null)).toBeFalse();
  });
});
