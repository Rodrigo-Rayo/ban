import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BandBuilderComponent, BuilderMusician, fillSlot } from './band-builder.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { MessagesService } from '../../core/services/messages.service';
import { ToastService } from '../../core/services/toast.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function builder(rows: unknown[] = []): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = { then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res) };
  ['select', 'eq', 'or', 'in', 'like', 'ilike', 'order', 'limit'].forEach(m => { b[m] = jasmine.createSpy(m).and.returnValue(b); });
  return b;
}

const mus = (over: Partial<BuilderMusician>): BuilderMusician => ({
  id: 'm' + Math.random(), name: 'Ana López', city: 'Madrid', avatar_url: null, instrument: 'Batería', genre: 'Rock',
  user_id: 'u' + Math.random(), created_at: '2026-11-01', ...over,
});
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

describe('BandBuilderComponent', () => {
  let params: BehaviorSubject<Record<string, string>>;
  let from: jasmine.Spy;
  let builders: ReturnType<typeof builder>[];
  let navigate: jasmine.Spy;
  let getConv: jasmine.Spy;
  let session: { user: { id: string } } | null;
  let savedCity: string | null;

  async function create(query: Record<string, string>, ...responses: unknown[][]) {
    params = new BehaviorSubject(query);
    builders = [];
    let n = 0;
    from = jasmine.createSpy('from').and.callFake(() => { const b = builder(responses[n++] ?? []); builders.push(b); return b; });
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    getConv = jasmine.createSpy('getOrCreateConversation').and.resolveTo({ id: 'conv-1' });
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: params } },
        { provide: Router, useValue: { navigate } },
        { provide: SupabaseService, useValue: { getSession: () => Promise.resolve({ data: { session } }), client: { from } } },
        { provide: SeoService, useValue: { set: () => {} } },
        { provide: MessagesService, useValue: { getOrCreateConversation: getConv } },
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
    TestBed.overrideComponent(BandBuilderComponent, { set: { imports: [], template: '<div></div>' } });
    const c = TestBed.createComponent(BandBuilderComponent).componentInstance;
    c.ngOnInit();
    await tick();
    await tick();
    return c;
  }

  beforeEach(() => {
    session = null;
    savedCity = localStorage.getItem('bandyou_city');
    localStorage.removeItem('bandyou_city');
  });
  afterEach(() => {
    if (savedCity === null) localStorage.removeItem('bandyou_city'); else localStorage.setItem('bandyou_city', savedCity);
  });

  it('reads place, instruments and style from the URL, dropping unknown and extra instruments', async () => {
    const c = await create({ donde: 'Sevilla', faltan: 'batería,Bajo,Otro,Kazoo,Bajo,Voz,Piano,Flauta,Arpa', estilo: 'rock' });
    expect(c.place()).toBe('Sevilla');
    expect(c.missing()).toEqual(['Batería', 'Bajo', 'Voz', 'Piano', 'Flauta']);
    expect(c.genre()).toBe('Rock');
    const b = builders[0];
    expect(b.select).toHaveBeenCalledWith('id,name,city,avatar_url,instrument,genre,user_id,created_at');
    expect(b.eq).toHaveBeenCalledWith('city', 'Sevilla');
    expect(b.or).toHaveBeenCalledWith(jasmine.stringContaining('instrument.ilike.%Batería%,instrument.ilike.%Bajo%'));
    expect(b.limit).toHaveBeenCalledWith(60);
  });

  it('defaults to the viewer\'s own known place, else the usual default, and asks nothing with no instruments', async () => {
    localStorage.setItem('bandyou_city', 'Pichincha, Ecuador');
    let c = await create({});
    expect(c.place()).toBe('Pichincha, Ecuador');
    expect(c.missing()).toEqual([]);
    expect(from).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    localStorage.setItem('bandyou_city', 'Mi pueblo');
    c = await create({});
    expect(c.place()).toBe('Toda España');
  });

  it('fills each slot with up to 3 who play it: style first, then with photo, then newest', () => {
    const rows = [
      mus({ id: 'a', instrument: 'Batería', genre: 'Pop' }),
      mus({ id: 'b', instrument: 'Batería, Voz', genre: 'Pop', avatar_url: 'x.jpg' }),
      mus({ id: 'c', instrument: 'Contrabajo', genre: 'Jazz' }),
      mus({ id: 'd', instrument: 'Batería', genre: 'Jazz, Blues' }),
      mus({ id: 'e', instrument: 'Batería', genre: 'Pop' }),
    ];
    expect(fillSlot(rows, 'Batería', 'Jazz').map(m => m.id)).toEqual(['d', 'b', 'a']);
    expect(fillSlot(rows, 'Bajo', '').map(m => m.id)).toEqual([]);
    expect(fillSlot(rows, 'Voz', '').map(m => m.id)).toEqual(['b']);
  });

  it('widens only the empty slots to neighbouring provinces, with one extra query', async () => {
    const c = await create({ donde: 'Sevilla', faltan: 'Batería,Bajo' },
      [mus({ id: 'd1', instrument: 'Batería', city: 'Sevilla' })],
      [mus({ id: 'b1', instrument: 'Bajo', city: 'Cádiz' })]);
    expect(from.calls.count()).toBe(2);
    expect(builders[1].in).toHaveBeenCalledWith('city', jasmine.arrayContaining(['Cádiz', 'Málaga']));
    expect(builders[1].or).toHaveBeenCalledWith('instrument.ilike.%Bajo%');
    const [drums, bass] = c.slots();
    expect(drums.musicians.map(m => m.id)).toEqual(['d1']);
    expect(drums.nearLabel).toBe('');
    expect(bass.musicians.map(m => m.id)).toEqual(['b1']);
    expect(bass.nearLabel).toBe('Cerca de Sevilla');
  });

  it('a region abroad widens to its whole country; no widening when every slot is filled', async () => {
    let c = await create({ donde: 'Pichincha, Ecuador', faltan: 'Bajo' }, [], [mus({ instrument: 'Bajo', city: 'Guayas, Ecuador' })]);
    expect(builders[1].like).toHaveBeenCalledWith('city', '%, Ecuador');
    expect(c.slots()[0].nearLabel).toBe('En todo Ecuador');

    TestBed.resetTestingModule();
    c = await create({ donde: 'Madrid', faltan: 'Bajo' }, [mus({ instrument: 'Bajo' })]);
    expect(from.calls.count()).toBe(1);
  });

  it('a style change reorders without asking again; instrument changes are debounced and stale answers ignored', async () => {
    const c = await create({ donde: 'Madrid', faltan: 'Bajo' }, [mus({ instrument: 'Bajo' })]);
    params.next({ donde: 'Madrid', faltan: 'Bajo', estilo: 'Jazz' });
    await tick();
    expect(from.calls.count()).toBe(1);

    c.toggle('Voz');
    expect(navigate.calls.mostRecent().args[1]).toEqual({ queryParams: { donde: 'Madrid', faltan: 'Bajo,Voz', estilo: 'Jazz' }, replaceUrl: true });
    params.next({ donde: 'Madrid', faltan: 'Bajo,Voz', estilo: 'Jazz' });
    params.next({ donde: 'Madrid', faltan: 'Bajo,Voz,Piano', estilo: 'Jazz' });
    await tick(50);
    expect(from.calls.count()).toBe(1);
    expect(c.loading()).toBeTrue();
    await tick(350);
    expect(from.calls.count()).toBeGreaterThanOrEqual(2);
    expect(builders[1].or).toHaveBeenCalledWith(jasmine.stringContaining('Piano'));
  });

  it('leaves out the viewer\'s own profile and rows without an account', async () => {
    session = { user: { id: 'me' } };
    const c = await create({ donde: 'Madrid', faltan: 'Bajo' },
      [mus({ id: 'mine', instrument: 'Bajo', user_id: 'me' }), mus({ id: 'seed', instrument: 'Bajo', user_id: '' }), mus({ id: 'ok', instrument: 'Bajo' })]);
    expect(c.slots()[0].musicians.map(m => m.id)).toEqual(['ok']);
  });

  it('¿Probamos? sends signed-out visitors to login without opening a chat', async () => {
    const c = await create({ donde: 'Madrid', faltan: 'Bajo' });
    await c.tryOut(mus({ instrument: 'Bajo' }), 'Bajo');
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(getConv).not.toHaveBeenCalled();
  });

  it('¿Probamos? opens the chat with a ready-written draft when signed in', async () => {
    session = { user: { id: 'me' } };
    const c = await create({ donde: 'Madrid', faltan: 'Batería' });
    const m = mus({ name: 'Ana López', user_id: 'u-ana' });
    await c.tryOut(m, 'Batería');
    expect(getConv).toHaveBeenCalledWith('u-ana', 'Ana López');
    expect(navigate).toHaveBeenCalledWith(['/inbox', 'conv-1'], { state: {
      name: 'Ana López',
      draft: '¡Hola Ana! Estoy armando una banda en Madrid y nos falta batería. ¿Te apetece quedar un día para probar?',
    } });
    expect(c.opening()).toBeNull();
  });

  it('¿Probamos? shows the service error and ignores clicks while opening', async () => {
    session = { user: { id: 'me' } };
    const c = await create({ donde: 'Toda España', faltan: 'Bajo' });
    getConv.and.resolveTo({ error: 'Este perfil aún no tiene cuenta activa.' });
    await c.tryOut(mus({}), 'Bajo');
    expect(TestBed.inject(ToastService).error).toHaveBeenCalledWith('Este perfil aún no tiene cuenta activa.');
    expect(navigate).not.toHaveBeenCalledWith(jasmine.arrayContaining(['/inbox']), jasmine.anything());

    c.opening.set('x');
    getConv.calls.reset();
    await c.tryOut(mus({}), 'Bajo');
    expect(getConv).not.toHaveBeenCalled();
    expect(c.draftFor(mus({ name: 'Leo' }), 'Voz')).toBe('¡Hola Leo! Estoy armando una banda y nos falta voz. ¿Te apetece quedar un día para probar?');
  });
});
