import { TestBed } from '@angular/core/testing';
import { FavoritesComponent } from './favorites.component';
import { FavoritesService } from '../../core/services/favorites.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { Favorite } from '../../core/models';

function makeFav(overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: 'f1',
    user_id: 'u1',
    entity_type: 'musician',
    entity_id: 'm1',
    created_at: new Date().toISOString(),
    ...overrides,
  } as any;
}

function mockBuilder(resolveValue: any = {}) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  ['select', 'in'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  return b;
}

describe('FavoritesComponent', () => {
  let component: FavoritesComponent;
  let favSvcSpy: jasmine.SpyObj<FavoritesService>;
  let supabaseSpy: any;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    favSvcSpy = jasmine.createSpyObj<FavoritesService>('FavoritesService', ['getByUser', 'toggle']);
    favSvcSpy.getByUser.and.returnValue(Promise.resolve([]));
    favSvcSpy.toggle.and.returnValue(Promise.resolve(false));
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    supabaseSpy = {
      auth: {
        getSession: jasmine.createSpy('getSession').and.returnValue(
          Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.returnValue(mockBuilder({ data: [] })),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FavoritesComponent,
        { provide: FavoritesService, useValue: favSvcSpy },
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    TestBed.overrideComponent(FavoritesComponent, { set: { imports: [], template: '<div></div>' } });
    component = TestBed.createComponent(FavoritesComponent).componentInstance;
  });

  describe('filteredFavs computed', () => {
    const musicianFav = makeFav({ entity_type: 'musician', entity_id: 'm1' });
    const bandFav = makeFav({ id: 'f2', entity_type: 'band', entity_id: 'b1' });

    beforeEach(() => {
      component.favorites.set([musicianFav, bandFav]);
    });

    it('returns all when tab is "all"', () => {
      component.activeTab.set('all');
      expect(component.filteredFavs().length).toBe(2);
    });

    it('filters by entity_type when tab is musician', () => {
      component.activeTab.set('musician');
      const filtered = component.filteredFavs();
      expect(filtered.length).toBe(1);
      expect(filtered[0].entity_type).toBe('musician');
    });

    it('returns empty when no favorites match the active tab', () => {
      component.activeTab.set('venue');
      expect(component.filteredFavs().length).toBe(0);
    });
  });

  describe('countByType computed', () => {
    it('counts correctly across multiple types', () => {
      component.favorites.set([
        makeFav({ entity_type: 'musician' }),
        makeFav({ id: 'f2', entity_type: 'musician' }),
        makeFav({ id: 'f3', entity_type: 'band' }),
      ]);
      const counts = component.countByType();
      expect(counts['musician']).toBe(2);
      expect(counts['band']).toBe(1);
    });

    it('returns empty object when no favorites', () => {
      component.favorites.set([]);
      expect(component.countByType()).toEqual({});
    });
  });

  describe('item()', () => {
    it('returns resolved entity when present', () => {
      const entity = { id: 'm1', name: 'Juan' };
      component.resolved.set({ 'musician:m1': entity as any });
      const fav = makeFav({ entity_type: 'musician', entity_id: 'm1' });
      expect(component.item(fav)).toEqual(entity as any);
    });

    it('returns null when entity not resolved', () => {
      component.resolved.set({});
      expect(component.item(makeFav())).toBeNull();
    });
  });

  describe('route()', () => {
    it('returns correct route for musician', () => {
      const fav = makeFav({ entity_type: 'musician', entity_id: 'm1' });
      expect(component.route(fav)).toEqual(['/musicians', 'm1']);
    });

    it('returns correct route for rehearsal', () => {
      const fav = makeFav({ entity_type: 'rehearsal', entity_id: 'r1' });
      expect(component.route(fav)).toEqual(['/rehearsal', 'r1']);
    });
  });

  describe('typeLabel()', () => {
    it('returns Músico for musician', () => {
      expect(component.typeLabel('musician')).toBe('Músico');
    });

    it('returns the raw type string for unknown types', () => {
      expect(component.typeLabel('unknown')).toBe('unknown');
    });
  });

  describe('detail()', () => {
    it('parses Postgres array strings into a clean list', () => {
      const fav = makeFav({ entity_type: 'venue' });
      expect(component.detail(fav, { id: 'v1', genres: '{ROCK,BLUES,FLAMENCO}' })).toBe('ROCK · BLUES · FLAMENCO');
    });

    it('puts the instrument before the genres', () => {
      const fav = makeFav();
      expect(component.detail(fav, { id: 'm1', instrument: 'Guitarra', genre: 'Rock' })).toBe('Guitarra · Rock');
    });

    it('is empty when there is nothing to show', () => {
      expect(component.detail(makeFav(), { id: 'm1' })).toBe('');
    });
  });

  describe('remove()', () => {
    const fav = makeFav({ id: 'f1' });
    const other = makeFav({ id: 'f2', entity_id: 'm2' });

    it('drops the favorite and calls the service', async () => {
      component.favorites.set([fav, other]);
      await component.remove(fav);
      expect(favSvcSpy.toggle).toHaveBeenCalledWith('u1', 'musician', 'm1');
      expect(component.favorites().map(f => f.id)).toEqual(['f2']);
    });

    it('restores the list and shows an error when the request fails', async () => {
      favSvcSpy.toggle.and.callFake(async () => { throw new Error('fail'); });
      component.favorites.set([fav, other]);
      await component.remove(fav);
      expect(component.favorites().length).toBe(2);
      expect(toastSpy.error).toHaveBeenCalled();
    });
  });

  describe('ngOnInit()', () => {
    it('loads favorites and sets resolved entities', async () => {
      const favs = [makeFav()];
      favSvcSpy.getByUser.and.returnValue(Promise.resolve(favs));
      const entityData = [{ id: 'm1', name: 'Juan', city: 'Madrid' }];
      supabaseSpy.client.from.and.returnValue(mockBuilder({ data: entityData }));

      await component.ngOnInit();

      expect(component.favorites()).toEqual(favs);
      expect(component.loading()).toBeFalse();
      expect(component.resolved()['musician:m1']).toEqual(entityData[0] as any);
    });

    it('does nothing and sets loading false when no session', async () => {
      supabaseSpy.auth.getSession.and.returnValue(
        Promise.resolve({ data: { session: null } })
      );
      await component.ngOnInit();
      expect(component.loading()).toBeFalse();
      expect(favSvcSpy.getByUser).not.toHaveBeenCalled();
    });

    it('sets loadError on exception', async () => {
      favSvcSpy.getByUser.and.callFake(async () => { throw new Error('fail'); });
      await component.ngOnInit();
      expect(component.loadError()).toBeTrue();
      expect(component.loading()).toBeFalse();
    });
  });
});
