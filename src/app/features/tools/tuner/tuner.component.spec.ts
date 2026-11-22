import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { ErrorListener, ReadingListener, TunerError, WindowMode } from './pitch-engine';
import { PitchEngineLike, TUNER_ENGINE_FACTORY, TunerComponent } from './tuner.component';

class FakeEngine implements PitchEngineLike {
  running = false;
  mode: WindowMode | null = null;
  startResult: Promise<void> = Promise.resolve();
  start = jasmine.createSpy('start').and.callFake(() => {
    this.running = true;
    return this.startResult;
  });
  stop = jasmine.createSpy('stop').and.callFake(() => { this.running = false; });
  setWindowMode(mode: WindowMode) { this.mode = mode; }
  constructor(readonly emit: ReadingListener, readonly fail: ErrorListener) {}
}

describe('TunerComponent', () => {
  let fixture: ComponentFixture<TunerComponent>;
  let engine: FakeEngine;
  let seo: jasmine.SpyObj<SeoService>;

  beforeEach(async () => {
    try { localStorage.removeItem('bandyou_tuner'); } catch { /* ignore */ }
    seo = jasmine.createSpyObj('SeoService', ['set', 'injectJsonLd']);
    await TestBed.configureTestingModule({
      imports: [TunerComponent],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seo },
        { provide: TUNER_ENGINE_FACTORY, useValue: (r: ReadingListener, e: ErrorListener) => (engine = new FakeEngine(r, e)) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TunerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    try { localStorage.removeItem('bandyou_tuner'); } catch { /* ignore */ }
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => el().querySelector(sel)?.textContent?.trim() ?? '';
  const emitFor = async (freq: number, frames: number, start = 0) => {
    for (let i = 0; i < frames; i++) engine.emit(freq, start + i * 25);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('renders the page head, SEO and structured data', () => {
    expect(text('h1')).toBe('Afinador online');
    expect(seo.set).toHaveBeenCalledWith(jasmine.objectContaining({ url: 'https://www.bandyou.es/afinador' }));
    const ld = seo.injectJsonLd.calls.mostRecent().args[0] as { '@graph': { '@type': string }[] };
    expect(ld['@graph'].map(g => g['@type'])).toEqual(['WebApplication', 'FAQPage']);
    expect(el().textContent).toContain('Activar micrófono');
  });

  it('starts the engine on tap and shows the detected note with cents and hint', async () => {
    (el().querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(engine.start).toHaveBeenCalled();
    expect(el().textContent).toContain('Parar');

    await emitFor(110 * Math.pow(2, 20 / 1200), 6);
    expect(text('[data-testid=tuner-note]')).toBe('La');
    expect(text('[data-testid=tuner-octave]')).toBe('2');
    expect(text('[data-testid=tuner-cents]')).toBe('+20 ¢');
    expect(text('[data-testid=tuner-hint]')).toContain('Baja');
  });

  it('turns to "Afinada" only after the pitch holds in tune for 300 ms', async () => {
    fixture.componentInstance.start();
    await fixture.whenStable();
    await emitFor(82.41, 4);
    expect(text('[data-testid=tuner-hint]')).toBe('Casi');
    await emitFor(82.41, 12, 100);
    expect(text('[data-testid=tuner-hint]')).toContain('Afinada');
  });

  it('auto-selects the bass E string for 41.2 Hz and uses the long window', async () => {
    const cmp = fixture.componentInstance;
    cmp.setMode('bass5');
    expect(engine.mode).toBe('long');
    cmp.start();
    await fixture.whenStable();
    await emitFor(41.2, 6);
    expect(cmp.readout()?.target?.index).toBe(1);
    const pressedOrActive = el().querySelectorAll('[aria-label="Cuerdas"] button')[1];
    expect(pressedOrActive.classList).toContain('bg-ink');
  });

  it('locks a string on tap and unlocks on a second tap', async () => {
    const cmp = fixture.componentInstance;
    cmp.setMode('guitar');
    fixture.detectChanges();
    const btn = () => el().querySelectorAll('[aria-label="Cuerdas"] button')[0] as HTMLButtonElement;
    btn().click();
    fixture.detectChanges();
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    cmp.start();
    await fixture.whenStable();
    await emitFor(110, 6);
    expect(cmp.readout()?.target?.index).toBe(0);
    expect(Math.round(cmp.readout()!.cents)).toBe(500);
    btn().click();
    fixture.detectChanges();
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('instrument mode: big note is the sounding note, target string below, "Sube mucho" when far', async () => {
    const cmp = fixture.componentInstance;
    cmp.setMode('guitar');
    cmp.start();
    await fixture.whenStable();
    await emitFor(73.42, 6);
    expect(text('[data-testid=tuner-note]')).toBe('Re');
    expect(text('[data-testid=tuner-octave]')).toBe('2');
    expect(text('[data-testid=tuner-target]')).toContain('Cuerda 6 · Mi2');
    expect(text('[data-testid=tuner-cents]')).toBe('−200 ¢');
    expect(text('[data-testid=tuner-hint]')).toContain('Sube mucho (tensa)');
  });

  it('never shows "Afinada" from a held value after the sound dies', async () => {
    const cmp = fixture.componentInstance;
    cmp.start();
    await fixture.whenStable();
    // In tune for only 200 ms, then silence: the hold must not complete the 300 ms.
    await emitFor(82.41, 9);
    for (let t = 225; t <= 900; t += 25) engine.emit(null, t);
    fixture.detectChanges();
    expect(cmp.inTune()).toBeFalse();
    expect(text('[data-testid=tuner-hint]')).not.toContain('Afinada');
  });

  it('drops "Afinada" as soon as the reading is only held', async () => {
    const cmp = fixture.componentInstance;
    cmp.start();
    await fixture.whenStable();
    await emitFor(82.41, 20);
    expect(cmp.inTune()).toBeTrue();
    engine.emit(null, 600);
    fixture.detectChanges();
    expect(cmp.inTune()).toBeFalse();
  });

  it('guitar mode stays on Mi2 through a 150 ms octave (2×) burst', async () => {
    const cmp = fixture.componentInstance;
    cmp.setMode('guitar');
    cmp.start();
    await fixture.whenStable();
    const seen = new Set<string>();
    let t = 0;
    const feed = (f: number, n: number) => {
      for (let i = 0; i < n; i++, t += 25) {
        engine.emit(f, t);
        const r = cmp.readout();
        if (r) seen.add(`${r.name}${r.octave}:${r.target?.index}`);
      }
    };
    feed(82.41, 30);
    feed(164.82, 6);
    feed(82.41, 20);
    expect([...seen]).toEqual(['Mi2:0']);
  });

  it('shows a Spanish error message when permission is denied', async () => {
    engine.startResult = Promise.reject(new TunerError('denied'));
    fixture.componentInstance.start();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text('[data-testid=tuner-error]')).toContain('permiso');
    expect(el().textContent).toContain('Reintentar');
  });

  it('switches notation and persists settings', async () => {
    const cmp = fixture.componentInstance;
    cmp.setNotation('en');
    cmp.stepA4(2);
    cmp.start();
    await fixture.whenStable();
    await emitFor(442, 6);
    expect(text('[data-testid=tuner-note]')).toBe('A');
    expect(Math.abs(cmp.readout()!.cents)).toBeLessThan(0.5);
    expect(JSON.parse(localStorage.getItem('bandyou_tuner')!)).toEqual(jasmine.objectContaining({ notation: 'en', a4: 442 }));
  });

  it('stops when the tab is hidden and on destroy', async () => {
    const cmp = fixture.componentInstance;
    cmp.start();
    await fixture.whenStable();
    spyOnProperty(document, 'visibilityState').and.returnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(engine.stop).toHaveBeenCalled();
    expect(cmp.status()).toBe('idle');
    expect(cmp.paused()).toBeTrue();
    fixture.detectChanges();
    expect(el().textContent).toContain('Reanudar');
    expect(engine.start).toHaveBeenCalledTimes(1); // no auto-restart
    cmp.start();
    await fixture.whenStable();
    window.dispatchEvent(new Event('pagehide'));
    expect(cmp.status()).toBe('idle');
    engine.stop.calls.reset();
    fixture.destroy();
    expect(engine.stop).toHaveBeenCalled();
  });
});
