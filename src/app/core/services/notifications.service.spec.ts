import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';
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

function mockChannelObject() {
  const ch: any = {};
  ch.on = jasmine.createSpy('on').and.returnValue(ch);
  ch.subscribe = jasmine.createSpy('subscribe').and.returnValue(ch);
  return ch;
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockClient: {
    from: jasmine.Spy;
    channel: jasmine.Spy;
    removeChannel: jasmine.Spy;
  };

  beforeEach(() => {
    mockClient = {
      from: jasmine.createSpy('from'),
      channel: jasmine.createSpy('channel'),
      removeChannel: jasmine.createSpy('removeChannel'),
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: { client: mockClient } },
      ],
    });

    service = TestBed.inject(NotificationsService);
  });

  describe('loadUnread', () => {
    it('sets unreadCount to the returned count value', async () => {
      const builder = mockBuilder({ count: 3, error: null });
      mockClient.from.and.returnValue(builder);

      await service.loadUnread('user-1');

      expect(service.unreadCount()).toBe(3);
    });

    it('sets unreadCount to 0 when count is null', async () => {
      const builder = mockBuilder({ count: undefined, error: null });
      mockClient.from.and.returnValue(builder);

      await service.loadUnread('user-1');

      expect(service.unreadCount()).toBe(0);
    });

    it('does not update unreadCount when error is returned', async () => {
      service.unreadCount.set(7);
      const builder = mockBuilder({ count: 5, error: { message: 'fail' } });
      mockClient.from.and.returnValue(builder);

      await service.loadUnread('user-1');

      expect(service.unreadCount()).toBe(7);
    });
  });

  describe('getAll', () => {
    it('returns the data array on success', async () => {
      const fakeData = [{ id: 'n-1' }, { id: 'n-2' }];
      const builder = mockBuilder({ data: fakeData, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.getAll('user-1');

      expect(result).toEqual(fakeData);
    });

    it('returns empty array when error is returned', async () => {
      const builder = mockBuilder({ data: [{ id: 'n-1' }], error: { message: 'fail' } });
      mockClient.from.and.returnValue(builder);

      const result = await service.getAll('user-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      const result = await service.getAll('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('markAllRead', () => {
    it('sets unreadCount signal to 0 on success', async () => {
      service.unreadCount.set(5);
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      await service.markAllRead('user-1');

      expect(service.unreadCount()).toBe(0);
    });

    it('does not set unreadCount to 0 when error occurs', async () => {
      service.unreadCount.set(5);
      const builder = mockBuilder({ data: null, error: { message: 'fail' } });
      mockClient.from.and.returnValue(builder);

      await service.markAllRead('user-1');

      expect(service.unreadCount()).toBe(5);
    });
  });

  describe('create', () => {
    it('calls insert() with the correct payload', async () => {
      const builder = mockBuilder({ data: null, error: null });
      mockClient.from.and.returnValue(builder);

      await service.create('user-1', 'message', 'You have a new message', 'Hello there', 'musician', 'entity-42');

      expect(builder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        type: 'message',
        title: 'You have a new message',
        body: 'Hello there',
        entity_type: 'musician',
        entity_id: 'entity-42',
      });
    });
  });

  describe('subscribe', () => {
    it('calls supabase.client.channel() with userId in channel name', () => {
      const ch = mockChannelObject();
      mockClient.channel.and.returnValue(ch);

      service.subscribe('user-1', () => {});

      expect(mockClient.channel).toHaveBeenCalledWith('notifications_user-1');
    });

    it('stores and returns the channel object', () => {
      const ch = mockChannelObject();
      mockClient.channel.and.returnValue(ch);

      const returned = service.subscribe('user-1', () => {});

      expect(returned).toBe(ch);
    });
  });

  describe('unsubscribe', () => {
    it('calls removeChannel when a channel exists', () => {
      const ch = mockChannelObject();
      mockClient.channel.and.returnValue(ch);
      service.subscribe('user-1', () => {});

      service.unsubscribe();

      expect(mockClient.removeChannel).toHaveBeenCalledWith(ch);
    });

    it('sets channel to null after unsubscribe', () => {
      const ch = mockChannelObject();
      mockClient.channel.and.returnValue(ch);
      service.subscribe('user-1', () => {});

      service.unsubscribe();

      const secondCh = mockChannelObject();
      mockClient.channel.and.returnValue(secondCh);
      mockClient.removeChannel.calls.reset();

      service.unsubscribe();

      expect(mockClient.removeChannel).not.toHaveBeenCalled();
    });

    it('does nothing when channel is null', () => {
      service.unsubscribe();

      expect(mockClient.removeChannel).not.toHaveBeenCalled();
    });
  });
});
