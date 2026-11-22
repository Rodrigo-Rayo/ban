import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MetronomeComponent, METRONOME_DEPS } from './metronome.component';
import { SeoService } from '../../../core/services/seo.service';
import { METRONOME_SEO } from './metronome-content';
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
    expect(seo.set).toHaveBeenCalledWith(jasmine.objectContaining({
      title: METRONOME_SEO.title, description: METRONOME_SEO.description, url: 'https://www.bandyou.es/metronomo',
    }));
    const ld = seo.injectJsonLd.calls.mostRecent().args[0] as { '@graph': { '@type': string; mainEntity?: unknown[] }[] };
    expect(ld['@graph'].map(n => n['@type'])).toEqual(['WebApplication', 'FAQPage', 'BreadcrumbList']);
    expect(ld['@graph'][1].mainEntity?.length).toBe(METRONOME_SEO.faqs.length);
    expect(el(f).querySelector('h1')?.textContent).toContain(METRONOME_SEO.h1);
  });

  it('renders the SEO copy from metronome-seo.json and the BandYou card under the tool', () => {
    const f = render();
    const text = el(f).textContent ?? '';
    expect(text).toContain(METRONOME_SEO.lead);
    METRONOME_SEO.faqs.forEach(q => expect(text).toContain(q.q));
    METRONOME_SEO.tips.forEach(t => expect(text).toContain(t.text));
    expect(text).toContain(METRONOME_SEO.tempoTable[0].feel);
    const cta = el(f).querySelector('app-tools-cta')!;
    expect(cta.textContent).toContain('¿Tocas en un grupo?');
    expect(cta.querySelector('a[href="/busco-banda"]')?.textContent).toContain('Busco banda');
    expect(cta.querySelector('a[href="/busco-musicos"]')?.textContent).toContain('Busco músicos');
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

  it('Space on the focused Start button toggles once (native click suppressed on keyup)', () => {
    const f = render();
    const start = el(f).querySelector('.start-btn') as HTMLButtonElement;
    expect(key(' ', start).defaultPrevented).toBeTrue();
    const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    start.dispatchEvent(up);
    expect(up.defaultPrevented).toBeTrue();
    expect(f.componentInstance.playing()).toBeTrue();
  });

  it('leaves Space, arrows and T alone on other controls (navbar, banners, links, fields)', () => {
    const f = render();
    const outside = document.createElement('button');
    const link = document.createElement('a');
    document.body.append(outside, link);
    try {
      for (const target of [outside, link, el(f).querySelector('.tap-btn')!, el(f).querySelector('#met-meter')!]) {
        expect(key(' ', target).defaultPrevented).withContext('space').toBeFalse();
        const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
        target.dispatchEvent(up);
        expect(up.defaultPrevented).toBeFalse();
      }
      expect(f.componentInstance.playing()).toBeFalse();
      for (const target of [outside, link, el(f).querySelector('a')!]) {
        expect(key('ArrowDown', target).defaultPrevented).withContext('arrow').toBeFalse();
        key('t', target);
      }
      expect(f.componentInstance.tapCount()).toBe(0);
      expect(bpmText(f)).toBe('100');
    } finally {
      outside.remove();
      link.remove();
    }
  });

  it('arrow keys change BPM by 1 and 5 from the body or a card button, not on fields or the slider', () => {
    const f = render();
    expect(bpmText(f)).toBe('100');
    expect(key('ArrowRight').defaultPrevented).toBeTrue();
    key('ArrowUp');
    expect(bpmText(f)).toBe('106');
    key('ArrowLeft', el(f).querySelector('.start-btn')!);
    key('ArrowDown', el(f).querySelector('.step-btn')!);
    expect(bpmText(f)).toBe('100');
    const select = el(f).querySelector('#met-meter') as HTMLSelectElement;
    expect(key('ArrowUp', select).defaultPrevented).toBeFalse();
    const slider = el(f).querySelector('#met-bpm') as HTMLInputElement;
    expect(key('ArrowUp', slider).defaultPrevented).toBeFalse();
    key('ArrowUp', document.body, { ctrlKey: true });
    expect(bpmText(f)).toBe('100');
  });

  it('T taps the tempo from the body or the Tap button', () => {
    const f = render();
    const now = spyOn(performance, 'now');
    const tapBtn = el(f).querySelector('.tap-btn')!;
    [0, 400, 800, 1200].forEach((t, i) => { now.and.returnValue(t); key('t', i % 2 ? tapBtn : document.body); });
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

  describe('screen wake lock', () => {
    let requests: { resolve: (l: unknown) => void }[];
    let locks: { released: number; listeners: (() => void)[]; release(): Promise<void>; addEventListener(t: string, fn: () => void): void }[];
    beforeEach(() => {
      requests = [];
      locks = [];
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: { request: () => new Promise(resolve => requests.push({ resolve })) },
      });
    });
    afterEach(() => delete (navigator as unknown as Record<string, unknown>)['wakeLock']);
    const newLock = () => {
      const l = {
        released: 0, listeners: [] as (() => void)[],
        release() { l.released++; return Promise.resolve(); },
        addEventListener(_t: string, fn: () => void) { l.listeners.push(fn); },
      };
      locks.push(l);
      return l;
    };
    const settle = () => new Promise(r => setTimeout(r));

    it('holds one lock while playing and releases it on stop', async () => {
      const f = render();
      f.componentInstance.toggle();
      requests[0].resolve(newLock());
      await settle();
      f.componentInstance.toggle();
      expect(locks[0].released).toBe(1);
    });

    it('a request still pending at stop is released as soon as it resolves; start/stop/start never holds two', async () => {
      const f = render();
      const c = f.componentInstance;
      c.toggle(); c.toggle(); c.toggle(); // start, stop, start while the first request is pending
      expect(requests.length).toBe(1);
      requests[0].resolve(newLock());
      await settle();
      expect(locks[0].released).toBe(0); // playing again: kept
      c.toggle();
      c.toggle();
      requests[1].resolve(newLock());
      c.toggle(); // stop before it resolved
      await settle();
      expect(locks[1].released).toBe(1);
    });

    it('re-requests after the browser releases the lock when the tab comes back', async () => {
      const f = render();
      f.componentInstance.toggle();
      requests[0].resolve(newLock());
      await settle();
      locks[0].listeners.forEach(fn => fn()); // tab hidden: browser released it
      document.dispatchEvent(new Event('visibilitychange'));
      expect(requests.length).toBe(2);
      f.componentInstance.toggle();
    });
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
