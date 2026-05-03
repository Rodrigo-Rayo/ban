import { TestBed } from '@angular/core/testing';
import { MessagesService } from './messages.service';
import { SupabaseService } from './supabase.service';
import { NotificationsService } from './notifications.service';
import { Conversation, Message } from '../models';

class MockSupabaseService {
  private sessionUser: { id: string; email: string } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromResponses: Map<string, any> = new Map();

  private _channelMock: any = {
    on: jasmine.createSpy('on').and.callFake(function(this: any) { return this; }),
    subscribe: jasmine.createSpy('subscribe').and.callFake(function(this: any) { return this; }),
  };

  readonly _client = {
    from: (table: string) => this._makeBuilder(table),
    channel: jasmine.createSpy('channel').and.callFake(() => this._channelMock),
    removeChannel: jasmine.createSpy('removeChannel'),
  };

  setUser(user: { id: string; email: string } | null) { this.sessionUser = user; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFromResponse(table: string, response: any) { this.fromResponses.set(table, response); }

  get auth() {
    const self = this;
    return {
      getSession: jasmine.createSpy('getSession').and.callFake(() =>
        Promise.resolve({ data: { session: self.sessionUser ? { user: self.sessionUser } : null } })
      ),
    };
  }

  get client() { return this._client; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _makeBuilder(table: string): any {
    const response = this.fromResponses.get(table) ?? { data: null, error: null, count: null };
    const b: any = {
      then(resolve: any, reject: any) { return Promise.resolve(response).then(resolve, reject); },
    };
    const chain = [
      'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq',
      'or', 'in', 'order', 'limit', 'range', 'ilike', 'head', 'not', 'gte', 'lte', 'lt', 'filter',
    ];
    chain.forEach(m => { b[m] = jasmine.createSpy(m).and.returnValue(b); });
    b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(response));
    b.single = jasmine.createSpy('single').and.returnValue(Promise.resolve(response));
    return b;
  }
}

describe('MessagesService', () => {
  let service: MessagesService;
  let mockSupabase: MockSupabaseService;
  let mockNotifSvc: jasmine.SpyObj<NotificationsService>;

  const fakeUser = { id: 'user-aaa', email: 'a@test.com' };
  const otherUser = { id: 'user-zzz', email: 'z@test.com' };

  beforeEach(() => {
    mockSupabase = new MockSupabaseService();
    mockNotifSvc = jasmine.createSpyObj('NotificationsService', ['create']);
    mockNotifSvc.create.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        MessagesService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifSvc },
      ],
    });

    service = TestBed.inject(MessagesService);
  });

  describe('getConversations', () => {
    it('returns empty array when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.getConversations();
      expect(result).toEqual([]);
    });

    it('returns conversations cast as Conversation array', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeConvs: Partial<Conversation>[] = [
        { id: 'conv-1', user1_id: 'user-aaa', user2_id: 'user-zzz', last_message: 'hi', last_message_at: null, created_at: '2024-01-01' },
      ];
      mockSupabase.setFromResponse('conversations', { data: fakeConvs, error: null, count: null });
      const result = await service.getConversations();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('conv-1');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: null });
      const result = await service.getConversations();
      expect(result).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('returns messages ordered ascending', async () => {
      const fakeMessages: Partial<Message>[] = [
        { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'user-aaa', text: 'hello', read: false, created_at: '2024-01-01T10:00:00Z' },
        { id: 'msg-2', conversation_id: 'conv-1', sender_id: 'user-zzz', text: 'world', read: false, created_at: '2024-01-01T10:01:00Z' },
      ];
      mockSupabase.setFromResponse('messages', { data: fakeMessages, error: null, count: null });
      const result = await service.getMessages('conv-1');
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: null });
      const result = await service.getMessages('conv-1');
      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('returns null when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.sendMessage('conv-1', 'hello');
      expect(result).toBeNull();
    });

    it('returns Message on success', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeMsg: Partial<Message> = {
        id: 'msg-new',
        conversation_id: 'conv-1',
        sender_id: 'user-aaa',
        text: 'hello',
        read: false,
        created_at: '2024-01-01T10:00:00Z',
      };
      mockSupabase.setFromResponse('messages', { data: fakeMsg, error: null, count: null });
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: null });
      const result = await service.sendMessage('conv-1', 'hello');
      expect(result).toBeTruthy();
      expect((result as Message).id).toBe('msg-new');
    });

    it('returns null when insert throws an error', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: { message: 'insert failed' }, count: null });
      const result = await service.sendMessage('conv-1', 'hello');
      expect(result).toBeNull();
    });

    it('inserts with field text not content', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeMsg: Partial<Message> = { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'user-aaa', text: 'ping', read: false, created_at: '' };
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: null });

      let capturedPayload: any = null;
      spyOn(mockSupabase, '_makeBuilder').and.callFake((table: string) => {
        const b = MockSupabaseService.prototype._makeBuilder.call(mockSupabase, table);
        if (table === 'messages') {
          const origInsert = b.insert;
          b.insert = jasmine.createSpy('insert').and.callFake((payload: any) => {
            capturedPayload = payload;
            return origInsert.call(b, payload);
          });
          b.single = jasmine.createSpy('single').and.returnValue(Promise.resolve({ data: fakeMsg, error: null }));
        }
        return b;
      });

      await service.sendMessage('conv-1', 'ping');
      expect(capturedPayload).toEqual(jasmine.objectContaining({ text: 'ping' }));
    });
  });

  describe('getOrCreateConversation', () => {
    it('returns error object when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.getOrCreateConversation('user-zzz');
      expect(result).toEqual(jasmine.objectContaining({ error: jasmine.any(String) }));
    });

    it('returns error object when otherUserId is empty string', async () => {
      mockSupabase.setUser(fakeUser);
      const result = await service.getOrCreateConversation('');
      expect(result).toEqual(jasmine.objectContaining({ error: jasmine.any(String) }));
    });

    it('returns existing conversation id when conversation already exists', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('conversations', { data: { id: 'conv-existing' }, error: null, count: null });
      const result = await service.getOrCreateConversation(otherUser.id);
      expect(result).toEqual(jasmine.objectContaining({ id: 'conv-existing' }));
    });

    it('creates new conversation and returns id when none exists', async () => {
      mockSupabase.setUser(fakeUser);

      let callCount = 0;
      const originalMakeBuilder = mockSupabase._makeBuilder.bind(mockSupabase);
      spyOn(mockSupabase, '_makeBuilder').and.callFake((table: string) => {
        const b = originalMakeBuilder(table);
        if (table === 'conversations') {
          callCount++;
          if (callCount === 1) {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: null, error: null, count: null })
            );
          } else {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: { id: 'conv-new' }, error: null, count: null })
            );
          }
        } else {
          b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
            Promise.resolve({ data: null, error: null, count: null })
          );
        }
        return b;
      });

      const result = await service.getOrCreateConversation(otherUser.id, 'OtherName');
      expect(result).toEqual(jasmine.objectContaining({ id: 'conv-new' }));
    });

    it('returns error object when insert fails', async () => {
      mockSupabase.setUser(fakeUser);

      let callCount = 0;
      const originalMakeBuilder = mockSupabase._makeBuilder.bind(mockSupabase);
      spyOn(mockSupabase, '_makeBuilder').and.callFake((table: string) => {
        const b = originalMakeBuilder(table);
        if (table === 'conversations') {
          callCount++;
          if (callCount === 1) {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: null, error: null, count: null })
            );
          } else {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: null, error: { message: 'insert error', code: '500' }, count: null })
            );
          }
        } else {
          b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
            Promise.resolve({ data: null, error: null, count: null })
          );
        }
        return b;
      });

      const result = await service.getOrCreateConversation(otherUser.id);
      expect(result).toEqual(jasmine.objectContaining({ error: jasmine.any(String) }));
    });

    it('sets user1_id and user2_id in lexicographic order', async () => {
      const userA = { id: 'aaa-user', email: 'a@test.com' };
      const userBId = 'zzz-user';
      mockSupabase.setUser(userA);

      let conversationsCallCount = 0;
      const originalMakeBuilder = mockSupabase._makeBuilder.bind(mockSupabase);
      let capturedInsertPayload: unknown = null;

      spyOn(mockSupabase, '_makeBuilder').and.callFake((table: string) => {
        const b = originalMakeBuilder(table);
        if (table === 'conversations') {
          conversationsCallCount++;
          if (conversationsCallCount === 1) {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: null, error: null, count: null })
            );
          } else {
            b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
              Promise.resolve({ data: { id: 'conv-ordered' }, error: null, count: null })
            );
          }
          const originalInsert = b.insert;
          b.insert = jasmine.createSpy('insert').and.callFake((payload: unknown) => {
            capturedInsertPayload = payload;
            return originalInsert.call(b, payload);
          });
        } else {
          b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
            Promise.resolve({ data: null, error: null, count: null })
          );
        }
        return b;
      });

      await service.getOrCreateConversation(userBId);
      expect(capturedInsertPayload).toEqual(jasmine.objectContaining({
        user1_id: 'aaa-user',
        user2_id: 'zzz-user',
      }));
    });
  });

  describe('getConversationById', () => {
    it('returns data when conversation is found', async () => {
      const fakeConv = { id: 'conv-1', user1_id: 'user-aaa', user2_id: 'user-zzz' };
      mockSupabase.setFromResponse('conversations', { data: fakeConv, error: null, count: null });
      const result = await service.getConversationById('conv-1');
      expect(result).toEqual(jasmine.objectContaining({ id: 'conv-1' }));
    });

    it('returns null when conversation is not found', async () => {
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: null });
      const result = await service.getConversationById('conv-missing');
      expect(result).toBeNull();
    });
  });

  describe('deleteConversation', () => {
    it('returns null on successful deletion when convCount is greater than zero', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: 1 });
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: 1 });
      const result = await service.deleteConversation('conv-1');
      expect(result).toBeNull();
    });

    it('returns error message when message deletion fails', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: { message: 'msg delete error' }, count: null });
      const result = await service.deleteConversation('conv-1');
      expect(result).toBe('msg delete error');
    });

    it('returns error message when conversation deletion fails', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: 1 });
      mockSupabase.setFromResponse('conversations', { data: null, error: { message: 'conv delete error' }, count: null });
      const result = await service.deleteConversation('conv-1');
      expect(result).toBe('conv delete error');
    });

    it('returns permissions error message when convCount is 0', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: 0 });
      mockSupabase.setFromResponse('conversations', { data: null, error: null, count: 0 });
      const result = await service.deleteConversation('conv-1');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('returns No autenticado when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.deleteConversation('conv-1');
      expect(result).toBe('No autenticado');
    });
  });

  describe('getUserName', () => {
    it('returns Usuario when userId is empty string', async () => {
      const result = await service.getUserName('');
      expect(result).toBe('Usuario');
    });

    it('returns name from first table that has data', async () => {
      mockSupabase.setFromResponse('musicians', { data: { name: 'Marta' }, error: null, count: null });
      const result = await service.getUserName('user-aaa');
      expect(result).toBe('Marta');
    });

    it('returns Usuario when no table has data for userId', async () => {
      const tables = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'];
      tables.forEach(t => mockSupabase.setFromResponse(t, { data: null, error: null, count: null }));
      const result = await service.getUserName('user-unknown');
      expect(result).toBe('Usuario');
    });
  });

  describe('getUnreadCount', () => {
    it('returns 0 when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.getUnreadCount();
      expect(result).toBe(0);
    });

    it('returns count from query', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeConvs: Partial<Conversation>[] = [
        { id: 'conv-1', user1_id: 'user-aaa', user2_id: 'user-zzz', last_message: null, last_message_at: null, created_at: '' },
      ];
      mockSupabase.setFromResponse('conversations', { data: fakeConvs, error: null, count: null });
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: 3 });
      const result = await service.getUnreadCount();
      expect(result).toBe(3);
    });

    it('returns 0 when count is null', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeConvs: Partial<Conversation>[] = [
        { id: 'conv-1', user1_id: 'user-aaa', user2_id: 'user-zzz', last_message: null, last_message_at: null, created_at: '' },
      ];
      mockSupabase.setFromResponse('conversations', { data: fakeConvs, error: null, count: null });
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: null });
      const result = await service.getUnreadCount();
      expect(result).toBe(0);
    });
  });

  describe('getUnreadConversationIds', () => {
    it('returns empty Set when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const result = await service.getUnreadConversationIds();
      expect(result.size).toBe(0);
    });

    it('returns Set of conversation_ids from unread messages', async () => {
      mockSupabase.setUser(fakeUser);
      const fakeData = [
        { conversation_id: 'conv-1' },
        { conversation_id: 'conv-2' },
        { conversation_id: 'conv-1' },
      ];
      mockSupabase.setFromResponse('messages', { data: fakeData, error: null, count: null });
      const result = await service.getUnreadConversationIds();
      expect(result.size).toBe(2);
      expect(result.has('conv-1')).toBeTrue();
      expect(result.has('conv-2')).toBeTrue();
    });
  });

  describe('markAsRead', () => {
    it('returns early without error when no user is logged in', async () => {
      mockSupabase.setUser(null);
      await expectAsync(service.markAsRead('conv-1')).toBeResolved();
    });

    it('calls update on messages table for the given conversation', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('messages', { data: null, error: null, count: null });
      await service.markAsRead('conv-1');
    });
  });

  describe('getOtherUserProfile', () => {
    it('returns Usuario when no user is logged in', async () => {
      mockSupabase.setUser(null);
      const conv = { id: 'conv-1', user1_id: 'user-aaa', user2_id: 'user-zzz', user1_name: 'Alice', user2_name: 'Bob' };
      const result = await service.getOtherUserProfile(conv);
      expect(result).toBe('Usuario');
    });

    it('returns cached user2_name when current user is user1', async () => {
      mockSupabase.setUser(fakeUser);
      const conv = { id: 'conv-1', user1_id: fakeUser.id, user2_id: otherUser.id, user1_name: 'Alice', user2_name: 'Bob' };
      const result = await service.getOtherUserProfile(conv);
      expect(result).toBe('Bob');
    });

    it('returns cached user1_name when current user is user2', async () => {
      mockSupabase.setUser(fakeUser);
      const conv = { id: 'conv-1', user1_id: otherUser.id, user2_id: fakeUser.id, user1_name: 'Alice', user2_name: 'Bob' };
      const result = await service.getOtherUserProfile(conv);
      expect(result).toBe('Alice');
    });

    it('falls back to getUserName when cached name is null', async () => {
      mockSupabase.setUser(fakeUser);
      mockSupabase.setFromResponse('musicians', { data: { name: 'FallbackName' }, error: null, count: null });
      const conv = { id: 'conv-1', user1_id: fakeUser.id, user2_id: otherUser.id, user1_name: null, user2_name: null };
      const result = await service.getOtherUserProfile(conv);
      expect(result).toBe('FallbackName');
    });
  });

  describe('subscribeToMessages', () => {
    it('calls channel() and returns a subscription', () => {
      mockSupabase._client.channel.calls.reset();
      const callback = jasmine.createSpy('callback');
      service.subscribeToMessages('conv-1', callback);
      expect(mockSupabase._client.channel).toHaveBeenCalled();
    });
  });

  describe('subscribeToInboxUpdates', () => {
    it('calls channel() and returns a subscription', () => {
      mockSupabase._client.channel.calls.reset();
      const callback = jasmine.createSpy('callback');
      service.subscribeToInboxUpdates(fakeUser.id, callback);
      expect(mockSupabase._client.channel).toHaveBeenCalled();
    });
  });
});
