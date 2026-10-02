import { TestBed } from '@angular/core/testing';
import { VacanciesService } from './vacancies.service';
import { SupabaseService } from './supabase.service';

/** Minimal chainable PostgREST query double that resolves to `result`. */
function query(result: { data: unknown; error: unknown }) {
  const q = {} as Record<string, jasmine.Spy>;
  for (const m of ['select', 'eq', 'in', 'ilike', 'order', 'range', 'limit']) q[m] = jasmine.createSpy(m).and.callFake(() => q);
  (q as unknown as { then: unknown }).then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return q;
}

describe('VacanciesService', () => {
  let svc: VacanciesService;
  let from: jasmine.Spy;

  const setup = (tables: Record<string, ReturnType<typeof query>[]>) => {
    from = jasmine.createSpy('from').and.callFake((t: string) => tables[t].shift());
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { from } } }] });
    svc = TestBed.inject(VacanciesService);
  };

  it('only asks for vacancies of existing bands and attaches each its band', async () => {
    const bands = query({ data: [{ id: 'b1', name: 'Los Relojes Rotos', city: 'Madrid' }], error: null });
    const vacancies = query({ data: [{ id: 'v1', band_id: 'b1', instrument: 'Bajo', created_at: '2026-10-01' }], error: null });
    setup({ bands: [bands], band_vacancies: [vacancies] });
    const result = await svc.listOpen();
    expect(vacancies['in']).toHaveBeenCalledWith('band_id', ['b1']);
    expect(result.length).toBe(1);
    expect(result[0].bands.name).toBe('Los Relojes Rotos');
  });

  it('filters by city through the bands of that city', async () => {
    const cityBands = query({ data: [{ id: 'b1' }], error: null });
    setup({ bands: [cityBands], band_vacancies: [query({ data: [], error: null })] });
    await svc.listOpen({ city: 'Madrid' });
    expect(cityBands['eq']).toHaveBeenCalledWith('city', 'Madrid');
  });

  it('returns nothing without querying vacancies when there is no band', async () => {
    setup({ bands: [query({ data: [], error: null })], band_vacancies: [] });
    expect(await svc.listOpen({ city: 'Soria' })).toEqual([]);
    expect(from).not.toHaveBeenCalledWith('band_vacancies');
  });

  it('propagates query errors', async () => {
    setup({ bands: [query({ data: [{ id: 'b1' }], error: null })], band_vacancies: [query({ data: null, error: { message: 'boom' } })] });
    await expectAsync(svc.listOpen()).toBeRejected();
  });
});
