import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MetronomeComponent, METRONOME_DEPS } from './metronome.component';
import { SeoService } from '../../../core/services/seo.service';
import { STORAGE_KEY } from './metronome-model';
import { FakeClock } from './testing/fake-audio';

describe('MetronomeComponent', () => {
  let clock: FakeClock;
  let seo: jasmine.SpyObj<SeoService>;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    clock = new FakeClock();
    seo = jasmine.createSpyObj('SeoService', ['set', 'injectJsonLd']);
  });
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seo },
        { provide: METRONOME_DEPS, useValue: clock.deps() },
      ],
    });
    const fixture = TestBed.createComponent(MetronomeComponent);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: ReturnType<typeof render>) => f.nativeElement as HTMLElement;
  const key = (k: string, target: EventTarget = document.body, extra: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
    target.dispatchEvent(ev);
    return ev;
  };
  const bpmText = (f: ReturnType<typeof render>) => { f.detectChanges(); return el(f).querySelector('.bpm')?.textContent?.trim(); };

  it('sets title, description and FAQ + WebApplication JSON-LD', () => {
    const f = render();
    expect(seo.set).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Metrónomo online gratis' }));
    const ld = seo.injectJsonLd.calls.mostRecent().args[0] as { '@graph': { '@type': string; mainEntity?: unknown[] }[] };
    expect(ld['@graph'].map(n => n['@type'])).toEqual(['WebApplication', 'FAQPage']);
    expect(ld['@graph'][1].mainEntity?.length).toBe(4);
    expect(el(f).querySelector('h1')?.textContent).toContain('Metrónomo online');
  });

  it('Start/Stop button and Space toggle the engine', () => {
    const f = render();
    const start = el(f).querySelector('.start-btn') as HTMLButtonElement;
    start.click();
    f.detectChanges();
    expect(f.componentInstance.playing()).toBeTrue();
    expect(start.textContent).toContain('Parar');
    clock.advance(0.3);
    expect(clock.ctx.audible.length).toBeGreaterThan(0);
    const ev = key(' ');
    expect(ev.defaultPrevented).toBeTrue();
    expect(f.componentInstance.playing()).toBeFalse();
    expect(clock.timers).toBe(0);
  });

  it('arrow keys change BPM by 1 and 5, but not while typing or on the focused slider', () => {
    const f = render();
    expect(bpmText(f)).toBe('100');
    key('ArrowRight'); key('ArrowUp');
    expect(bpmText(f)).toBe('106');
    key('ArrowLeft'); key('ArrowDown');
    expect(bpmText(f)).toBe('100');
    const select = el(f).querySelector('#met-meter') as HTMLSelectElement;
    key('ArrowUp', select);
    const slider = el(f).querySelector('#met-bpm') as HTMLInputElement;
    key('ArrowUp', slider);
    key('ArrowUp', document.body, { ctrlKey: true });
    expect(bpmText(f)).toBe('100');
  });

  it('T taps the tempo', () => {
    const f = render();
    const now = spyOn(performance, 'now');
    [0, 400, 800, 1200].forEach(t => { now.and.returnValue(t); key('t'); });
    expect(bpmText(f)).toBe('150');
  });

  it('− / + buttons: keyboard click steps once; press and hold repeats', fakeAsync(() => {
    const f = render();
    const plus = el(f).querySelectorAll('.step-btn')[1] as HTMLButtonElement;
    plus.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(bpmText(f)).toBe('101');
    plus.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    tick(400 + 70 * 5);
    plus.dispatchEvent(new PointerEvent('pointerup'));
    plus.dispatchEvent(new MouseEvent('click', { detail: 1 })); // pointer click already handled
    tick(500);
    expect(bpmText(f)).toBe('107');
  }));

  it('slider, compás, subdivisión, sonido, volume and accent update the engine and persist', () => {
    const f = render();
    const c = f.componentInstance;
    const slider = el(f).querySelector('#met-bpm') as HTMLInputElement;
    slider.value = '144';
    slider.dispatchEvent(new Event('input'));
    c.setMeter('6/8');
    c.setSound('wood');
    c.toggleAccent();
    const vol = el(f).querySelector('#met-vol') as HTMLInputElement;
    vol.value = '40';
    vol.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(c.compound()).toBeTrue();
    expect((el(f).querySelector('#met-sub') as HTMLSelectElement).disabled).toBeTrue();
    expect(el(f).querySelectorAll('.beat').length).toBe(6);
    expect(el(f).querySelectorAll('.beat-strong').length).toBe(2);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toEqual({ bpm: 144, meter: '6/8', subdivision: 1, sound: 'wood', volume: 0.4, accent: false });
    TestBed.resetTestingModule();
    const g = render();
    expect(bpmText(g)).toBe('144');
    expect(g.componentInstance.settings().meter).toBe('6/8');
  });

  it('announces BPM changes once, debounced', fakeAsync(() => {
    const f = render();
    key('ArrowRight'); key('ArrowRight'); key('ArrowRight');
    tick(300);
    expect(f.componentInstance.announcement()).toBe('');
    tick(700);
    expect(f.componentInstance.announcement()).toBe('103 BPM, Andante');
  }));

  it('lights the beat being heard', async () => {
    const f = render();
    f.componentInstance.toggle();
    clock.advance(0.1);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    f.detectChanges();
    expect(el(f).querySelector('.beat-on')).toBe(el(f).querySelectorAll('.beat')[0]);
    f.componentInstance.toggle();
    f.detectChanges();
    expect(el(f).querySelector('.beat-on')).toBeNull();
  });

  it('cleans up on destroy: stops, closes audio, removes the JSON-LD', () => {
    const ld = document.createElement('script');
    ld.id = 'ld-json';
    document.head.appendChild(ld);
    const f = render();
    f.componentInstance.toggle();
    clock.advance(0.2);
    f.destroy();
    expect(clock.ctx.closed).toBeTrue();
    expect(clock.timers).toBe(0);
    expect(document.getElementById('ld-json')).toBeNull();
  });

  it('shows a message when Web Audio is unavailable', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SeoService, useValue: seo }, { provide: METRONOME_DEPS, useValue: { createContext: () => null } }],
    });
    const f = TestBed.createComponent(MetronomeComponent);
    f.detectChanges();
    (el(f).querySelector('.start-btn') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('[role="alert"]')).not.toBeNull();
  });
});
