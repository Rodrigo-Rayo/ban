import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatComponent } from './chat.component';
import { MessagesService } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Message } from '../../core/models';

// ---------------------------------------------------------------------------
// Supabase query-builder mock — supports full method chaining and awaiting.
// ---------------------------------------------------------------------------
function mockBuilder(resolveValue: { data?: any; error?: any; count?: number }) {
  const b: any = {
    then(resolve: any, reject: any) {
      return Promise.resolve(resolveValue).then(resolve, reject);
    },
  };
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'or', 'in',
   'order', 'limit', 'range', 'ilike', 'head', 'not', 'gte', 'lte', 'lt',
   'filter'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  b.single     = jasmine.createSpy('single').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

describe('ChatComponent', () => {
  let component: ChatComponent;
  let msgSvc: jasmine.SpyObj<MessagesService>;
  let supabaseSpy: any;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeMock: any;

  const fakeMsg: Message = {
    id: 'msg-1',
    conversation_id: 'conv-123',
    sender_id: 'u1',
    content: 'hello',
    created_at: new Date().toISOString(),
  } as any;

  const makeMessage = (over: Partial<Message>): Message => ({
    ...fakeMsg, text: 'hi', read: false, sender_id: 'me', ...over,
  } as Message);

  const fakeChannel: any = { unsubscribe: jasmine.createSpy('unsubscribe') };

  beforeEach(async () => {
    msgSvc = jasmine.createSpyObj<MessagesService>('MessagesService', [
      'getMessages', 'getConversationById', 'getOtherUserProfile',
      'markAsRead', 'sendMessage', 'deleteConversation',
      'subscribeToMessages', 'setActiveChat', 'sendTyping',
    ]);
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [], hasMore: false }));
    msgSvc.getConversationById.and.returnValue(Promise.resolve(null));
    msgSvc.getOtherUserProfile.and.returnValue(Promise.resolve('Test User'));
    msgSvc.markAsRead.and.returnValue(Promise.resolve());
    msgSvc.subscribeToMessages.and.returnValue(fakeChannel);
    msgSvc.setActiveChat.and.stub();

    supabaseSpy = {
      auth: {
        getUser: jasmine.createSpy('getUser').and.returnValue(
          Promise.resolve({ data: { user: { id: 'u1' } } })
        ),
      },
      client: {
        removeChannel: jasmine.createSpy('removeChannel'),
      },
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routeMock = {
      snapshot: { paramMap: { get: jasmine.createSpy('get').and.returnValue('conv-123') } },
    };

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        { provide: MessagesService,  useValue: msgSvc },
        { provide: SupabaseService,  useValue: supabaseSpy },
        { provide: Router,           useValue: routerSpy },
        { provide: ActivatedRoute,   useValue: routeMock },
      ],
    })
    .overrideComponent(ChatComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(ChatComponent).componentInstance;
  });

  // -------------------------------------------------------------------------
  // ngOnInit
  // -------------------------------------------------------------------------

  it('1. redirects to /inbox when no route id', async () => {
    routeMock.snapshot.paramMap.get.and.returnValue(null);
    await component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/inbox']);
    expect(msgSvc.setActiveChat).not.toHaveBeenCalled();
  });

  it('2. calls setActiveChat with conversation id', async () => {
    await component.ngOnInit();
    expect(msgSvc.setActiveChat).toHaveBeenCalledWith('conv-123');
  });

  it('3. sets messages from getMessages result', async () => {
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [fakeMsg], hasMore: false }));
    await component.ngOnInit();
    expect(component.messages()).toEqual([fakeMsg]);
  });

  it('4. sets hasMore true from getMessages result', async () => {
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [], hasMore: true }));
    await component.ngOnInit();
    expect(component.hasMore()).toBeTrue();
  });

  it('5. sets currentUserId from supabase.auth.getUser', async () => {
    await component.ngOnInit();
    expect(component.currentUserId()).toBe('u1');
  });

  it('6. sets sendError on exception and loading becomes false', async () => {
    msgSvc.getMessages.and.returnValue(Promise.reject(new Error('network')));
    await component.ngOnInit();
    expect(component.sendError()).toBe('No se pudieron cargar los mensajes. Inténtalo de nuevo.');
    expect(component.loading()).toBeFalse();
  });

  it('7. loading becomes false after successful init (finally)', async () => {
    await component.ngOnInit();
    expect(component.loading()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // send()
  // -------------------------------------------------------------------------

  it('8. send() does nothing when newMessage is empty', async () => {
    component.newMessage = '   ';
    await component.send();
    expect(msgSvc.sendMessage).not.toHaveBeenCalled();
  });

  it('9. send() does nothing when already sending', async () => {
    component.sending.set(true);
    component.newMessage = 'hello';
    await component.send();
    expect(msgSvc.sendMessage).not.toHaveBeenCalled();
  });

  it('10. send() calls sendMessage with trimmed content', async () => {
    msgSvc.sendMessage.and.returnValue(Promise.resolve(fakeMsg));
    (component as any).conversationId = 'conv-123';
    component.newMessage = '  hello world  ';
    await component.send();
    expect(msgSvc.sendMessage).toHaveBeenCalledWith('conv-123', 'hello world');
  });

  it('11. send() clears newMessage on success', fakeAsync(async () => {
    msgSvc.sendMessage.and.returnValue(Promise.resolve(fakeMsg));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    await component.send();
    tick(0);
    expect(component.newMessage).toBe('');
  }));

  it('12. send() deduplicates: does not add message if same id already exists', fakeAsync(async () => {
    msgSvc.sendMessage.and.returnValue(Promise.resolve(fakeMsg));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    component.messages.set([fakeMsg]);          // same id already present
    await component.send();
    tick(0);
    expect(component.messages().length).toBe(1); // still 1 — no duplicate
  }));

  it('12b. send() appends message when not already in list', fakeAsync(async () => {
    const newMsg = { ...fakeMsg, id: 'msg-2' } as Message;
    msgSvc.sendMessage.and.returnValue(Promise.resolve(newMsg));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    component.messages.set([fakeMsg]);
    await component.send();
    tick(0);
    expect(component.messages().length).toBe(2);
    expect(component.messages()[1]).toEqual(newMsg);
  }));

  it('13. send() sets sendError when sendMessage returns null', async () => {
    msgSvc.sendMessage.and.returnValue(Promise.resolve(null));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    await component.send();
    expect(component.sendError()).toBe('Error desconocido al enviar.');
  });

  it('14. send() sets sendError on thrown exception', async () => {
    msgSvc.sendMessage.and.returnValue(Promise.reject(new Error('network')));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    await component.send();
    expect(component.sendError()).toBe('No se pudo enviar. Inténtalo de nuevo.');
  });

  it('14b. failed send keeps a failed bubble that can be retried', async () => {
    msgSvc.sendMessage.and.returnValue(Promise.reject(new Error('network')));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'retry me';
    await component.send();
    const failed = component.messages().find(m => m.status === 'failed');
    expect(failed?.text).toBe('retry me');

    const stored = { ...fakeMsg, id: 'msg-ok', text: 'retry me' } as Message;
    msgSvc.sendMessage.and.returnValue(Promise.resolve(stored));
    await component.retry(failed!);
    expect(component.messages().length).toBe(1);
    expect(component.messages()[0]).toEqual(stored);
  });

  it('14c. send() rejects drafts over the max length without calling the service', async () => {
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'x'.repeat(component.maxLength + 1);
    await component.send();
    expect(msgSvc.sendMessage).not.toHaveBeenCalled();
    expect(component.sendError()).toContain(String(component.maxLength));
  });

  it('14d. realtime echo of own message replaces the optimistic bubble', () => {
    (component as any).conversationId = 'conv-123';
    component.currentUserId.set('u1');
    component.messages.set([{ ...fakeMsg, id: 'tmp-1', text: 'hi', status: 'sending' } as any]);
    (component as any).onIncoming({ ...fakeMsg, id: 'real-1', text: 'hi', sender_id: 'u1' });
    expect(component.messages().map(m => m.id)).toEqual(['real-1']);
  });

  it('14e. realtime messages from other conversations are ignored', () => {
    (component as any).conversationId = 'conv-123';
    (component as any).onIncoming({ ...fakeMsg, id: 'x', conversation_id: 'other' });
    expect(component.messages().length).toBe(0);
  });

  it('15. send() resets sending to false in finally', async () => {
    msgSvc.sendMessage.and.returnValue(Promise.resolve(null));
    (component as any).conversationId = 'conv-123';
    component.newMessage = 'test';
    await component.send();
    expect(component.sending()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // onKeydown()
  // -------------------------------------------------------------------------

  it('16. onKeydown calls send() on Enter without shift', () => {
    spyOn(component, 'send');
    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
    spyOn(event, 'preventDefault');
    component.onKeydown(event);
    expect(component.send).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('17. onKeydown does NOT call send() on Enter+Shift', () => {
    spyOn(component, 'send');
    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
    component.onKeydown(event);
    expect(component.send).not.toHaveBeenCalled();
  });

  it('18. onKeydown does NOT call send() on non-Enter key', () => {
    spyOn(component, 'send');
    const event = new KeyboardEvent('keydown', { key: 'a', shiftKey: false });
    component.onKeydown(event);
    expect(component.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // deleteConversation()
  // -------------------------------------------------------------------------

  it('19. deleteConversation does nothing when isDeleting is true', async () => {
    component.isDeleting.set(true);
    await component.deleteConversation();
    expect(msgSvc.deleteConversation).not.toHaveBeenCalled();
  });

  it('20. deleteConversation does nothing when user cancels confirm', async () => {
    spyOn(window, 'confirm').and.returnValue(false);
    await component.deleteConversation();
    expect(msgSvc.deleteConversation).not.toHaveBeenCalled();
  });

  it('21. deleteConversation calls service.deleteConversation and navigates to /inbox on success', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    msgSvc.deleteConversation.and.returnValue(Promise.resolve(null));
    (component as any).conversationId = 'conv-123';
    await component.deleteConversation();
    expect(msgSvc.deleteConversation).toHaveBeenCalledWith('conv-123');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/inbox']);
  });

  it('22. deleteConversation sets sendError when service returns error string', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    msgSvc.deleteConversation.and.returnValue(Promise.resolve('Error al borrar'));
    (component as any).conversationId = 'conv-123';
    await component.deleteConversation();
    expect(component.sendError()).toBe('Error al borrar');
  });

  it('23. deleteConversation sets sendError on thrown exception', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    msgSvc.deleteConversation.and.returnValue(Promise.reject(new Error('network')));
    (component as any).conversationId = 'conv-123';
    await component.deleteConversation();
    expect(component.sendError()).toBe('No se pudo eliminar la conversación.');
  });

  it('24. deleteConversation resets isDeleting to false in finally', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    msgSvc.deleteConversation.and.returnValue(Promise.resolve(null));
    (component as any).conversationId = 'conv-123';
    await component.deleteConversation();
    expect(component.isDeleting()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // loadMore()
  // -------------------------------------------------------------------------

  it('25. loadMore does nothing when loadingMore is true', async () => {
    component.loadingMore.set(true);
    await component.loadMore();
    expect(msgSvc.getMessages).not.toHaveBeenCalled();
  });

  it('26. loadMore does nothing when hasMore is false', async () => {
    component.hasMore.set(false);
    await component.loadMore();
    expect(msgSvc.getMessages).not.toHaveBeenCalled();
  });

  it('27. loadMore prepends older messages using the oldest loaded message as cursor', async () => {
    const oldMsg: Message = { id: 'old-1', conversation_id: 'conv-123', sender_id: 'u2', content: 'older', created_at: '2024-01-01T00:00:00Z' } as any;
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [oldMsg], hasMore: false }));
    component.hasMore.set(true);
    (component as any).conversationId = 'conv-123';
    component.messages.set([fakeMsg]);
    await component.loadMore();
    expect(component.messages()).toEqual([oldMsg, fakeMsg]);
    expect(msgSvc.getMessages).toHaveBeenCalledWith('conv-123', 50, fakeMsg.created_at);
  });

  it('27b. loadMore cursor is unaffected by realtime messages appended after load', async () => {
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [], hasMore: false }));
    component.hasMore.set(true);
    (component as any).conversationId = 'conv-123';
    const live = { ...fakeMsg, id: 'live-1', created_at: new Date(Date.now() + 1000).toISOString() } as Message;
    component.messages.set([fakeMsg, live]);
    await component.loadMore();
    expect(msgSvc.getMessages).toHaveBeenCalledWith('conv-123', 50, fakeMsg.created_at);
  });

  it('27c. loadMore skips messages already present', async () => {
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [fakeMsg], hasMore: false }));
    component.hasMore.set(true);
    (component as any).conversationId = 'conv-123';
    component.messages.set([fakeMsg]);
    await component.loadMore();
    expect(component.messages().length).toBe(1);
  });

  it('28. loadMore updates hasMore from result', async () => {
    msgSvc.getMessages.and.returnValue(Promise.resolve({ messages: [], hasMore: true }));
    component.hasMore.set(true);
    (component as any).conversationId = 'conv-123';
    await component.loadMore();
    expect(component.hasMore()).toBeTrue();
  });

  it('29. loadMore resets loadingMore to false in finally even on exception', async () => {
    msgSvc.getMessages.and.returnValue(Promise.reject(new Error('fail')));
    component.hasMore.set(true);
    (component as any).conversationId = 'conv-123';
    await component.loadMore();
    expect(component.loadingMore()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // ngOnDestroy()
  // -------------------------------------------------------------------------

  it('30. ngOnDestroy calls setActiveChat(null) and removeChannel', async () => {
    await component.ngOnInit();
    component.ngOnDestroy();
    expect(msgSvc.setActiveChat).toHaveBeenCalledWith(null);
    expect(supabaseSpy.client.removeChannel).toHaveBeenCalledWith(fakeChannel);
  });

  // -------------------------------------------------------------------------
  // formatMessageTime()
  // -------------------------------------------------------------------------

  it('31. returns empty string for empty input', () => {
    expect(component.formatMessageTime('')).toBe('');
  });

  it('32. returns "ahora" for a timestamp less than 1 minute ago', () => {
    const now = new Date(Date.now() - 30 * 1000).toISOString(); // 30 sec ago
    expect(component.formatMessageTime(now)).toBe('ahora');
  });

  it('33. returns "hace X min" for a timestamp less than 60 minutes ago', () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(component.formatMessageTime(thirtyMinsAgo)).toBe('hace 30 min');
  });

  it('34. returns "hace X h" for a timestamp less than 24 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(component.formatMessageTime(twoHoursAgo)).toBe('hace 2 h');
  });

  it('35. returns "ayer HH:MM" for a timestamp from yesterday', () => {
    // Yesterday midnight is always >= 24 hours ago, and always has yesterday's date string.
    const now = new Date();
    const yesterdayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const result = component.formatMessageTime(yesterdayMidnight.toISOString());
    expect(result).toBe('ayer 00:00');
  });

  it('36. returns "DD/MM HH:MM" for timestamps older than yesterday', () => {
    // Use a fixed past date well outside any edge case.
    const oldDate = new Date(2020, 0, 15, 10, 5); // 15 Jan 2020 10:05
    const result = component.formatMessageTime(oldDate.toISOString());
    expect(result).toBe('15/01 10:05');
  });

  it('marks our message as read when the realtime UPDATE arrives', () => {
    (component as any).conversationId = 'conv-123';
    component.messages.set([makeMessage({ id: 'm1', read: false }), makeMessage({ id: 'm2', read: false })]);
    (component as any).onUpdated(makeMessage({ id: 'm1', read: true }));
    expect(component.messages().find(m => m.id === 'm1')!.read).toBeTrue();
    expect(component.messages().find(m => m.id === 'm2')!.read).toBeFalse();
  });

  it('ignores UPDATE events from another conversation', () => {
    (component as any).conversationId = 'conv-123';
    component.messages.set([makeMessage({ id: 'm1', read: false })]);
    (component as any).onUpdated(makeMessage({ id: 'm1', read: true, conversation_id: 'other' }));
    expect(component.messages()[0].read).toBeFalse();
  });

  describe('typing and presence', () => {
    beforeEach(() => {
      (component as any).otherUserId = 'other';
      (component as any).subscription = fakeChannel;
      component.currentUserId.set('me');
    });

    it('shows "typing" when the other participant types and hides it after a pause', fakeAsync(() => {
      (component as any).onOtherTyping('other');
      expect(component.otherTyping()).toBeTrue();
      tick(3600);
      expect(component.otherTyping()).toBeFalse();
    }));

    it('ignores typing signals from anyone else', () => {
      (component as any).onOtherTyping('stranger');
      expect(component.otherTyping()).toBeFalse();
    });

    it('marks the other participant online from presence', () => {
      (component as any).onlineIds = ['me', 'other'];
      (component as any).refreshOnline();
      expect(component.otherOnline()).toBeTrue();
      (component as any).onlineIds = ['me'];
      (component as any).refreshOnline();
      expect(component.otherOnline()).toBeFalse();
    });

    it('throttles our typing broadcasts', () => {
      msgSvc.sendTyping.calls.reset();
      component.newMessage = 'h';
      component.onDraftInput();
      component.onDraftInput();
      expect(msgSvc.sendTyping).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast typing for an empty draft', () => {
      msgSvc.sendTyping.calls.reset();
      component.newMessage = '   ';
      component.onDraftInput();
      expect(msgSvc.sendTyping).not.toHaveBeenCalled();
    });
  });

  it('shows "Usuario" when the other participant has no profile name', async () => {
    msgSvc.getConversationById.and.returnValue(Promise.resolve({ id: 'conv-123', user1_id: 'a', user2_id: 'b' } as any));
    msgSvc.getOtherUserProfile.and.returnValue(Promise.resolve('Usuario'));
    await component.ngOnInit();
    await Promise.resolve();
    expect(component.otherName()).toBe('Usuario');
  });
});
