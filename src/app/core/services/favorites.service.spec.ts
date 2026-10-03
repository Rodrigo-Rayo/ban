import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';
import { SupabaseService } from './supabase.service';
import { NotificationsService } from './notifications.service';

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
  let mockClient: { from: jasmine.Spy; rpc: jasmine.Spy };
  let notifSpy: jasmine.SpyObj<NotificationsService>;

  beforeEach(() => {
    mockClient = {
      from: jasmine.createSpy('from'),
      rpc: jasmine.createSpy('rpc').and.returnValue(Promise.resolve({ data: 'Lola García', error: null })),
    };
    notifSpy = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['create']);
    notifSpy.create.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        FavoritesService,
        { provide: SupabaseService, useValue: { client: mockClient } },
        { provide: NotificationsService, useValue: notifSpy },
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

    it('calls upsert() and returns true when not yet a favorite', async () => {
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
      expect(secondBuilder.upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', entity_type: 'musician', entity_id: 'entity-1' },
        jasmine.objectContaining({ onConflict: 'user_id,entity_type,entity_id' }),
      );
    });
  });

  describe('toggle → owner notification', () => {
    /** favorites: not yet saved (or saved when `alreadyFav`); profile tables: owned by `ownerId`. */
    function wire(ownerId: string | null, alreadyFav = false) {
      mockClient.from.and.callFake((table: string) => table === 'favorites'
        ? mockBuilder({ data: alreadyFav ? { id: 'fav-1' } : null, error: null })
        : mockBuilder({ data: ownerId ? { user_id: ownerId } : null, error: null }));
    }
    const settle = () => new Promise(r => setTimeout(r));

    it('notifies the profile owner anonymously when a profile is added', async () => {
      wire('owner-1');
      await service.toggle('user-1', 'musician', 'entity-1');
      await settle();
      expect(mockClient.from).toHaveBeenCalledWith('musicians');
      expect(mockClient.rpc).not.toHaveBeenCalledWith('get_profile_name', jasmine.anything());
      expect(notifSpy.create).toHaveBeenCalledOnceWith(
        'owner-1', 'favorite', 'Alguien ha guardado tu perfil', undefined, 'musician', 'entity-1');
    });

    it('resolves the owner from the right table for each profile kind', async () => {
      wire('owner-1');
      await service.toggle('user-1', 'rehearsal', 'entity-1');
      await settle();
      expect(mockClient.from).toHaveBeenCalledWith('rehearsal_spaces');
      expect(notifSpy.create).toHaveBeenCalledWith('owner-1', 'favorite', jasmine.any(String), undefined, 'rehearsal', 'entity-1');
    });

    it('falls back to "Alguien" when the sender has no name', async () => {
      wire('owner-1');
      mockClient.rpc.and.returnValue(Promise.resolve({ data: null, error: null }));
      await service.toggle('user-1', 'band', 'entity-1');
      await settle();
      expect(notifSpy.create).toHaveBeenCalledWith('owner-1', 'favorite', 'Alguien ha guardado tu perfil', undefined, 'band', 'entity-1');
    });

    it('does not notify on remove', async () => {
      wire('owner-1', true);
      await service.toggle('user-1', 'musician', 'entity-1');
      await settle();
      expect(notifSpy.create).not.toHaveBeenCalled();
    });

    it('does not notify when you save your own profile', async () => {
      wire('user-1');
      await service.toggle('user-1', 'teacher', 'entity-1');
      await settle();
      expect(notifSpy.create).not.toHaveBeenCalled();
    });

    it('does not notify for non-profile favorites such as events', async () => {
      wire('owner-1');
      await service.toggle('user-1', 'event', 'entity-1');
      await settle();
      expect(notifSpy.create).not.toHaveBeenCalled();
      expect(mockClient.from).not.toHaveBeenCalledWith('events');
    });

    it('still reports the favorite as saved when the notification fails', async () => {
      wire('owner-1');
      notifSpy.create.and.returnValue(Promise.reject(new Error('rate limit')));
      const result = await service.toggle('user-1', 'venue', 'entity-1');
      await settle();
      expect(result).toBeTrue();
    });
  });

  describe('getByUser', () => {
    it('returns the data array when query resolves with data', async () => {
      const fakeData = [{ id: 'fav-1' }, { id: 'fav-2' }];
      const builder = mockBuilder({ data: fakeData, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.getByUser('user-1');

      expect(result).toEqual(fakeData as any[]);
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
