import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { routes } from '../../../app.routes';
import { SeoService } from '../../../core/services/seo.service';
import { WindowMode } from './pitch-engine';
import { TUNER_SEO, tunerPageFor, tuningRowsFor } from './tuner-content';
import { TUNER_SLUGS, isTunerSlug } from './tuner-slugs';
import { PitchEngineLike, TUNER_ENGINE_FACTORY, TunerComponent } from './tuner.component';

class IdleEngine implements PitchEngineLike {
  running = false;
  start = () => Promise.resolve();
  stop = () => undefined;
  setWindowMode(_m: WindowMode) { /* not needed */ }
}

const KEY = 'bandyou_tuner';
const clearStore = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

describe('tuner SEO pages (tuner-seo.json)', () => {
  it('route slugs match the JSON pages', () => {
    expect(TUNER_SEO.pages.filter(p => p.slug).map(p => p.slug)).toEqual([...TUNER_SLUGS]);
    expect(isTunerSlug('bajo')).toBeTrue();
    expect(isTunerSlug('banjo')).toBeFalse();
    expect(isTunerSlug(undefined)).toBeFalse();
  });

  it('every page has its own title, ≤155-char description, h1 and 3+ FAQs', () => {
    const titles = new Set<string>();
    for (const p of TUNER_SEO.pages) {
      expect(p.description.length).withContext(p.path).toBeLessThanOrEqual(155);
      expect(p.faqs.length).withContext(p.path).toBeGreaterThanOrEqual(3);
      expect(p.h1).toBeTruthy();
      titles.add(p.title);
    }
    expect(titles.size).toBe(TUNER_SEO.pages.length);
  });

  it('maps slugs to modes and lists the page\'s own tunings first', () => {
    expect(tunerPageFor('guitarra')!.mode).toBe('guitar');
    expect(tunerPageFor('bajo')!.mode).toBe('bass4');
    expect(tunerPageFor('ukelele')!.mode).toBe('ukulele');
    expect(tunerPageFor(null)!.mode).toBeNull();
    expect(tunerPageFor('banjo')).toBeNull();
    expect(tuningRowsFor(tunerPageFor('bajo')!).slice(0, 2).map(r => r.id)).toEqual(['bass4', 'bass5']);
    expect(tuningRowsFor(tunerPageFor('bajo')!).length).toBe(TUNER_SEO.tunings.length);
  });
});

describe('TunerComponent on instrument pages', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let seo: jasmine.SpyObj<SeoService>;
  let router: Router;

  function render(slug: string | null) {
    params = new BehaviorSubject(convertToParamMap(slug ? { instrumento: slug } : {}));
    seo = jasmine.createSpyObj('SeoService', ['set', 'injectJsonLd']);
    TestBed.configureTestingModule({
      imports: [TunerComponent],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seo },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: TUNER_ENGINE_FACTORY, useValue: () => new IdleEngine() },
      ],
    });
    router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(TunerComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(clearStore);
  afterEach(clearStore);

  it('/afinador/bajo preselects Bajo 4 cuerdas and shows its own copy', () => {
    const f = render('bajo');
    const page = tunerPageFor('bajo')!;
    const el = f.nativeElement as HTMLElement;
    expect(f.componentInstance.settings().mode).toBe('bass4');
    expect(el.querySelector('h1')!.textContent!.trim()).toBe('Afinador de bajo online');
    expect(el.textContent).toContain(page.lead);
    expect(el.querySelector('[data-testid=tuner-intro]')!.textContent).toContain(page.intro);
    page.faqs.forEach(q => expect(el.textContent).toContain(q.a));
    page.howTo.steps.forEach(s => expect(el.textContent).toContain(s));
    expect(el.querySelector('tbody th')!.textContent).toContain('Bajo 4 cuerdas');
    expect(seo.set).toHaveBeenCalledWith({ title: page.title, description: page.description, url: 'https://www.bandyou.es/afinador/bajo' });
    const ld = seo.injectJsonLd.calls.mostRecent().args[0] as { '@graph': { itemListElement?: { item: string }[] }[] };
    expect(ld['@graph'][2].itemListElement!.map(i => i.item)).toEqual([
      'https://www.bandyou.es/', 'https://www.bandyou.es/afinador', 'https://www.bandyou.es/afinador/bajo',
    ]);
    // Links to the other tuner pages and the tools CTA.
    expect(el.querySelector('a[href="/afinador/guitarra"]')).toBeTruthy();
    expect(el.querySelector('a[href="/afinador/ukelele"]')).toBeTruthy();
    expect(el.querySelector('a[href="/afinador"]')).toBeTruthy();
    expect(el.querySelector('app-tools-cta a[href="/busco-banda"]')).toBeTruthy();
  });

  it('does not overwrite the mode saved on /afinador', () => {
    localStorage.setItem(KEY, JSON.stringify({ a4: 440, notation: 'es', mode: 'ukulele' }));
    const f = render('guitarra');
    const cmp = f.componentInstance;
    expect(cmp.settings().mode).toBe('guitar');
    cmp.setNotation('en');
    cmp.setMode('bass5');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ a4: 440, notation: 'en', mode: 'ukulele' });
  });

  it('/afinador keeps the saved mode and saves changes to it', () => {
    localStorage.setItem(KEY, JSON.stringify({ a4: 440, notation: 'es', mode: 'ukulele' }));
    const f = render(null);
    expect(f.componentInstance.settings().mode).toBe('ukulele');
    expect((f.nativeElement as HTMLElement).querySelector('h1')!.textContent!.trim()).toBe('Afinador online');
    f.componentInstance.setMode('bass5');
    expect(JSON.parse(localStorage.getItem(KEY)!).mode).toBe('bass5');
  });

  it('follows the param when the component is reused (guitarra → ukelele)', () => {
    const f = render('guitarra');
    params.next(convertToParamMap({ instrumento: 'ukelele' }));
    f.detectChanges();
    expect(f.componentInstance.settings().mode).toBe('ukulele');
    expect((f.nativeElement as HTMLElement).querySelector('h1')!.textContent).toContain('ukelele');
  });

  it('an unknown slug falls back to /afinador', () => {
    const f = render(null);
    const nav = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    params.next(convertToParamMap({ instrumento: 'banjo' }));
    f.detectChanges();
    expect(nav).toHaveBeenCalledWith('/afinador', { replaceUrl: true });
  });
});

@Component({ template: '' })
class BlankComponent {}

describe('afinador routes (app.routes.ts)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: BlankComponent }, ...routes.filter(r => r.path?.startsWith('afinador'))]),
        { provide: TUNER_ENGINE_FACTORY, useValue: () => new IdleEngine() },
      ],
    });
  });
  afterEach(clearStore);

  it('loads the tuner on an instrument slug', async () => {
    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/afinador/ukelele', TunerComponent);
    expect(cmp.settings().mode).toBe('ukulele');
    expect(TestBed.inject(Router).url).toBe('/afinador/ukelele');
  });

  it('redirects an unknown slug to /afinador', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/afinador/banjo');
    expect(TestBed.inject(Router).url).toBe('/afinador');
  });
});
