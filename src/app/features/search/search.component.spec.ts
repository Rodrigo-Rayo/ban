import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SearchComponent } from './search.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeoService } from '../../core/services/seo.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function builder(rows: unknown[] = []): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = { then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res) };
  ['select', 'eq', 'in', 'like', 'ilike', 'filter', 'gte', 'order', 'range'].forEach(m => { b[m] = jasmine.createSpy(m).and.returnValue(b); });
  return b;
}

describe('SearchComponent', () => {
  let params: BehaviorSubject<Record<string, string>>;
  let from: jasmine.Spy;
  let navigate: jasmine.Spy;
  let gigsColumn: boolean;
  let last: ReturnType<typeof builder>;

  async function create(query: Record<string, string>) {
    params = new BehaviorSubject(query);
    last = builder();
    from = jasmine.createSpy('from').and.callFake(() => (last = builder()));
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        SearchComponent,
        { provide: ActivatedRoute, useValue: { queryParams: params } },
        { provide: Router, useValue: { navigate } },
        { provide: SupabaseService, useValue: { auth: { getUser: () => Promise.resolve({ data: { user: null } }) }, client: { from } } },
        { provide: SeoService, useValue: { set: () => {} } },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(gigsColumn), state: () => signal(gigsColumn).asReadonly() } },
      ],
    });
    TestBed.overrideComponent(SearchComponent, { set: { imports: [], template: '<div></div>' } });
    const c = TestBed.createComponent(SearchComponent).componentInstance;
    await c.ngOnInit();
    await new Promise(r => setTimeout(r));
    return c;
  }

  beforeEach(() => { gigsColumn = true; });

  it('an empty province suggests the provinces next to it that have musicians', async () => {
    const c = await create({ tab: 'musicians', city: 'Sevilla' });
    // First query (Sevilla) came back empty; the next one asks the neighbours.
    expect(from.calls.count()).toBe(2);
    expect(last.in).toHaveBeenCalledWith('city', jasmine.arrayContaining(['Cádiz', 'Málaga']));
    from.and.returnValues(builder(), builder([{ city: 'Málaga' }, { city: 'Málaga' }, { city: 'Cádiz' }]));
    await c.loadData();
    await new Promise(r => setTimeout(r));
    expect(c.nearby()).toEqual([{ city: 'Málaga', n: 2 }, { city: 'Cádiz', n: 1 }]);
  });

  it('asks nothing extra when the list has results or a search text', async () => {
    const c = await create({ tab: 'musicians', city: 'Madrid', q: 'ana' });
    expect(from.calls.count()).toBe(1);
    expect(c.nearby()).toEqual([]);
  });

  it('?tab=bands&bolos=1 asks only for bands open to gigs', async () => {
    const c = await create({ tab: 'bands', bolos: '1' });
    expect(c.gigsOnly()).toBeTrue();
    expect(from).toHaveBeenCalledWith('bands');
    expect(last.select.calls.mostRecent().args[0]).toContain('open_to_gigs');
    expect(last.eq).toHaveBeenCalledWith('open_to_gigs', true);
    expect(c.activeFilterCount()).toBe(1);
  });

  it('never names open_to_gigs while the column does not exist', async () => {
    gigsColumn = false;
    const c = await create({ tab: 'bands', bolos: '1' });
    expect(last.select.calls.mostRecent().args[0]).not.toContain('open_to_gigs');
    expect(last.eq).not.toHaveBeenCalledWith('open_to_gigs', true);
    expect(c.canFilterGigs()).toBeFalse();
    expect(c.activeFilterCount()).toBe(0);
    expect(c.emptyMode()).toBe('none');
  });

  it('the gigs filter only lives on the bands tab and goes into the URL', async () => {
    const c = await create({ tab: 'musicians', bolos: '1' });
    expect(c.gigsOnly()).toBeFalse();

    c.activeTab.set('bands');
    c.gigsOnly.set(true);
    c.filterChanged();
    expect(navigate.calls.mostRecent().args[1].queryParams).toEqual({ tab: 'bands', bolos: '1' });

    await c.setTab('musicians');
    expect(c.gigsOnly()).toBeFalse();
    expect(navigate.calls.mostRecent().args[1].queryParams).toEqual({ tab: 'musicians' });
  });

  it('clearFilters also clears the gigs filter', async () => {
    const c = await create({ tab: 'bands', bolos: '1' });
    c.clearFilters();
    expect(c.gigsOnly()).toBeFalse();
  });

  it('initials use the first and last word', async () => {
    const c = await create({});
    expect(c.initials('Sofía López')).toBe('SL');
    expect(c.initials('Los Lunes Grises')).toBe('LG');
    expect(c.initials('')).toBe('?');
  });
});
