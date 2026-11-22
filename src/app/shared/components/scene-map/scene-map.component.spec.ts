import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { SceneMapComponent } from './scene-map.component';
import { loadSceneCounts, resetSceneCounts } from './scene-counts';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const COUNTS = {
  musicians: { Sevilla: 3, Madrid: 12, 'Córdoba, Argentina': 2 },
  bands: { Sevilla: 1, Madrid: 4 },
  posts: { Sevilla: 2, 'Córdoba, Argentina': 1 },
};

describe('SceneMapComponent', () => {
  let fixture: ComponentFixture<SceneMapComponent>;
  let el: HTMLElement;

  async function setup(response: Promise<Response>, city: string | null = null) {
    resetSceneCounts();
    spyOn(window, 'fetch').and.returnValue(response);
    spyOn(Storage.prototype, 'getItem').and.callFake(k => (k === 'bandyou_city' ? city : null));
    await TestBed.configureTestingModule({
      imports: [SceneMapComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { isLoggedIn: signal(false) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SceneMapComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await loadSceneCounts();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const tile = (label: string) => el.querySelector<HTMLButtonElement>(`button[title="${label}"]`)!;
  const links = () => [...el.querySelectorAll<HTMLAnchorElement>('[role="region"] a')].map(a => [a.textContent!.trim(), a.getAttribute('href')]);
  const click = (b: HTMLElement) => { b.click(); fixture.detectChanges(); };

  afterEach(() => resetSceneCounts());

  it('renders the 52 province tiles of Spain with counts in their labels', async () => {
    await setup(Promise.resolve(json(COUNTS)));
    expect(el.querySelectorAll('button[title]').length).toBe(52);
    expect(tile('Sevilla').getAttribute('aria-label')).toBe('Sevilla: 3 músicos, 1 banda, 2 anuncios');
    expect(tile('Madrid').className).toContain('bg-primary-500');
    expect(tile('Sevilla').className).toContain('bg-poster-yellow');
    expect(tile('Soria').className).toContain('bg-dark-800');
    expect(el.textContent).toContain('20 músicos y bandas en 2 provincias · 2 anuncios activos');
  });

  it('selecting a tile shows the panel with links for that place', async () => {
    await setup(Promise.resolve(json(COUNTS)));
    click(tile('Sevilla'));
    expect(tile('Sevilla').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[role="region"] h3')!.textContent).toContain('Sevilla');
    expect(links()).toEqual([
      ['Ver músicos', '/search?tab=musicians&city=Sevilla'],
      ['Ver bandas', '/search?tab=bands&city=Sevilla'],
      ['Se busca', '/feed?city=Sevilla'],
      ['Arma tu banda aquí', '/arma-tu-banda?donde=Sevilla'],
    ]);
    click(tile('Sevilla'));
    expect(el.querySelector('[role="region"]')).toBeNull();
  });

  it('an empty place invites to be the first one', async () => {
    await setup(Promise.resolve(json(COUNTS)));
    click(tile('Soria'));
    expect(el.textContent).toContain('Aún no hay nadie en Soria.');
    expect(links()).toEqual([['Sé el primero de Soria', '/auth/register']]);
  });

  it('keeps the tiles and links when the counts cannot be loaded', async () => {
    await setup(Promise.reject(new TypeError('offline')));
    expect(el.querySelectorAll('button[title]').length).toBe(52);
    expect(tile('Sevilla').getAttribute('aria-label')).toBe('Sevilla');
    expect(tile('Sevilla').className).toContain('bg-dark-700');
    click(tile('Sevilla'));
    expect(links().length).toBe(4);
    expect(el.textContent).not.toContain('Aún no hay nadie');
  });

  it('opens on the viewer\'s own country and lists its regions, busiest first', async () => {
    await setup(Promise.resolve(json(COUNTS)), 'Mendoza, Argentina');
    expect(el.querySelector('select')!.value).toBe('AR');
    const chips = [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    expect(chips.length).toBe(1);
    expect(chips[0].getAttribute('aria-label')).toBe('Córdoba: 2 músicos, 0 bandas, 1 anuncio');
    const more = [...el.querySelectorAll('button')].find(b => b.textContent!.includes('Ver todas'))!;
    expect(more.textContent).toContain('Ver todas (23)');
    click(more);
    expect(el.querySelectorAll('button[aria-pressed]').length).toBe(24);
    click(chips[0]);
    expect(links()[0][0]).toBe('Ver músicos');
    expect(decodeURIComponent(links()[0][1]!)).toBe('/search?tab=musicians&city=Córdoba, Argentina');
  });

  it('switching country renders that country\'s region list', async () => {
    await setup(Promise.resolve(json(COUNTS)));
    const select = el.querySelector('select')!;
    select.value = 'BO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelectorAll('button[title]').length).toBe(0);
    expect(el.textContent).toContain('Aún no hay nadie en Bolivia.');
    expect([...el.querySelectorAll('button[aria-pressed]')].map(b => b.textContent!.trim())).toContain('La Paz');
  });
});
