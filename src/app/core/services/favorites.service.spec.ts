import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';
import { SupabaseService } from './supabase.service';

function mockBuilder(resolveValue: { data?: any; error?: any; count?: number }) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  const chain = ['select','insert','update','upsert','delete','eq','neq',
    'or','in','order','limit','range','ilike','head','not','gte','lte','lt','filter'];
  chain.forEach(m => { b[m] = jasmine.createSpy(m).and.returnValue(b); });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  b.single = jasmine.createSpy('single').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

describe('FavoritesService', () => {
  let service: FavoritesService;
  let mockClient: { from: jasmine.Spy };

  beforeEach(() => {
    mockClient = { from: jasmine.createSpy('from') };

    TestBed.configureTestingModule({
      providers: [
        FavoritesService,
        { provide: SupabaseService, useValue: { client: mockClient } },
      ],
    });

    service = TestBed.inject(FavoritesService);
  });

  describe('isFavorite', () => {
    it('returns true when maybeSingle resolves with data', async () => {
      const builder = mockBuilder({ data: { id: 'fav-1' }, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.isFavorite('user-1', 'musician', 'entity-1');

      expect(result).toBeTrue();
    });

    it('returns false when maybeSingle resolves with null data', async () => {
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.isFavorite('user-1', 'musician', 'entity-1');

      expect(result).toBeFalse();
    });

    it('calls .eq() with correct user_id, entity_type and entity_id arguments', async () => {
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      await service.isFavorite('user-42', 'band', 'entity-99');

      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-42');
      expect(builder.eq).toHaveBeenCalledWith('entity_type', 'band');
      expect(builder.eq).toHaveBeenCalledWith('entity_id', 'entity-99');
    });
  });

  describe('toggle', () => {
    it('calls delete() and returns false when already a favorite', async () => {
      let callCount = 0;
      mockClient.from.and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          return mockBuilder({ data: { id: 'fav-1' }, error: null });
        }
        return mockBuilder({ data: null, error: null });
      });

      const result = await service.toggle('user-1', 'musician', 'entity-1');

      expect(result).toBeFalse();
      const secondBuilder = mockClient.from.calls.all()[1].returnValue;
      expect(secondBuilder.delete).toHaveBeenCalled();
    });

    it('calls insert() and returns true when not yet a favorite', async () => {
      let callCount = 0;
      mockClient.from.and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          return mockBuilder({ data: null, error: null });
        }
        return mockBuilder({ data: null, error: null });
      });

      const result = await service.toggle('user-1', 'musician', 'entity-1');

      expect(result).toBeTrue();
      const secondBuilder = mockClient.from.calls.all()[1].returnValue;
      expect(secondBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        entity_type: 'musician',
        entity_id: 'entity-1',
      });
    });
  });

  describe('getByUser', () => {
    it('returns the data array when query resolves with data', async () => {
      const fakeData = [{ id: 'fav-1' }, { id: 'fav-2' }];
      const builder = mockBuilder({ data: fakeData, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.getByUser('user-1');

      expect(result).toEqual(fakeData);
    });

    it('returns empty array when data is null', async () => {
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.getByUser('user-1');

      expect(result).toEqual([]);
    });

    it('calls .order() with created_at and ascending false', async () => {
      const builder = mockBuilder({ data: [], error: null });
      mockClient.from.and.returnValue(builder);

      await service.getByUser('user-1');

      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });
});
