import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GearListComponent } from './gear-list.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';

function mockBuilder(resolveValue: { data?: any; error?: any } = { data: [], error: null }) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  ['select', 'eq', 'in', 'lt', 'order', 'limit'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  return b;
}

describe('GearListComponent', () => {
  let builder: any;
  let routerSpy: jasmine.SpyObj<Router>;

  function create(params: Record<string, string> = {}) {
    builder = mockBuilder();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        GearListComponent,
        { provide: SupabaseService, useValue: { client: { from: () => builder } } },
        { provide: AuthService, useValue: { isLoggedIn: () => false } },
        { provide: SeoService, useValue: { set: () => {} } },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => params[k] ?? null } } } },
      ],
    });
    return TestBed.inject(GearListComponent);
  }

  it('filters "Bueno" by every stored alias (good + legacy "bueno")', async () => {
    const c = create();
    c.filterCondition.set('good');
    await c.loadListings();
    expect(builder.in).toHaveBeenCalledWith('condition', ['good', 'bueno']);
    expect(builder.eq).not.toHaveBeenCalledWith('condition', jasmine.anything());
  });

  it('offers "Muy bueno" as a condition filter', () => {
    const c = create();
    expect(c.conditions.map(x => x.label)).toContain('Muy bueno');
  });

  it('restores the filters from the URL on init', async () => {
    const c = create({ ciudad: 'Madrid', categoria: 'Bajos', estado: 'like_new' });
    await c.ngOnInit();
    expect(c.filterCity()).toBe('Madrid');
    expect(c.filterCategory()).toBe('Bajos');
    expect(c.filterCondition()).toBe('like_new');
    expect(builder.eq).toHaveBeenCalledWith('city', 'Madrid');
    expect(builder.in).toHaveBeenCalledWith('condition', ['like_new', 'como nuevo']);
  });

  it('ignores unknown values in the URL', async () => {
    const c = create({ ciudad: 'Narnia', categoria: 'Nada', estado: 'roto' });
    await c.ngOnInit();
    expect(c.filterCity()).toBe('Toda España');
    expect(c.filterCategory()).toBe('');
    expect(c.filterCondition()).toBe('');
  });

  it('writes the filters to the URL and drops empty ones', async () => {
    const c = create();
    c.filterCity.set('Sevilla');
    c.filterCondition.set('good');
    await c.applyFilters();
    expect(routerSpy.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { ciudad: 'Sevilla', categoria: null, estado: 'good' },
    }));
  });

  it('clearFilters resets the URL', async () => {
    const c = create();
    c.filterCategory.set('Bajos');
    await c.clearFilters();
    expect(routerSpy.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { ciudad: null, categoria: null, estado: null },
    }));
    expect(c.hasFilters()).toBeFalsy();
  });
});
