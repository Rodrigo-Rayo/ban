import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { InboxComponent } from './inbox.component';
import { MessagesService, InboxUpdate } from '../../core/services/messages.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Conversation } from '../../core/models';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    user1_id: 'user-aaa',
    user2_id: 'user-bbb',
    user1_name: 'Alice',
    user2_name: 'Bob',
    last_message: 'hello',
    last_message_at: '2024-01-01T10:00:00Z',
    created_at: '2024-01-01T09:00:00Z',
    ...overrides,
  };
}

function makeEvent(): Event {
  return {
    preventDefault: jasmine.createSpy('preventDefault'),
    stopPropagation: jasmine.createSpy('stopPropagation'),
  } as unknown as Event;
}

// ── Spec ───────────────────────────────────────────────────────────────────

describe('InboxComponent', () => {
  let component: InboxComponent;
  let fixture: ComponentFixture<InboxComponent>;
  let messagesSpy: jasmine.SpyObj<MessagesService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let inboxUpdate$: Subject<InboxUpdate>;
  let pushMock: { permission: NotificationPermission | 'unsupported'; isSupported: boolean; requestAndSubscribe: jasmine.Spy };

  const defaultConversation = makeConversation();

  beforeEach(async () => {
    inboxUpdate$ = new Subject<InboxUpdate>();
    pushMock = {
      permission: 'granted',
      isSupported: true,
      requestAndSubscribe: jasmine.createSpy('requestAndSubscribe').and.resolveTo('granted'),
    };

    messagesSpy = jasmine.createSpyObj<MessagesService>(
      'MessagesService',
      [
        'getConversations',
        'getConversationById',
        'getOtherUserProfile',
        'getUnreadConversationIds',
        'deleteConversation',
        'setActiveChat',
        'markAsRead',
      ],
      // Read-only properties provided via the third argument of createSpyObj
      { inboxUpdate$: inboxUpdate$ }
    );

    // Default happy-path return values
    messagesSpy.getConversations.and.returnValue(
      Promise.resolve([defaultConversation])
    );
    messagesSpy.getOtherUserProfile.and.returnValue(Promise.resolve('Bob'));
    messagesSpy.getConversationById.and.callFake((id: string) =>
      Promise.resolve(makeConversation({ id }))
    );
    messagesSpy.getUnreadConversationIds.and.returnValue(
      Promise.resolve(new Set<string>())
    );
    messagesSpy.deleteConversation.and.returnValue(Promise.resolve(null));
    messagesSpy.markAsRead.and.returnValue(Promise.resolve());

    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', [
      'error',
      'success',
    ]);

    // SupabaseService is injected by the component but never called in the
    // methods under test; a bare minimal mock is sufficient.
    const supabaseMock = {};

    await TestBed.configureTestingModule({
      imports: [InboxComponent],
      providers: [
        { provide: MessagesService, useValue: messagesSpy },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastSpy },
        { provide: PushNotificationService, useValue: pushMock },
        { provide: AuthService, useValue: { user: () => ({ id: 'user-1' }) } },
      ],
    })
      .overrideComponent(InboxComponent, {
        set: { imports: [], template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(InboxComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Initial signal state ───────────────────────────────────────────────────

  it('starts with loading true', () => {
    expect(component.loading()).toBeTrue();
  });

  it('starts with an empty conversations list', () => {
    expect(component.conversations()).toEqual([]);
  });

  // ── ngOnInit() – happy path ────────────────────────────────────────────────

  describe('ngOnInit() – data loading', () => {
    it('sets conversations from the service', async () => {
      await component.ngOnInit();
      expect(component.conversations()).toEqual([defaultConversation]);
    });

    it('populates the names map with the other user profile for each conversation', async () => {
      messagesSpy.getOtherUserProfile.and.returnValue(Promise.resolve('Bob'));
      await component.ngOnInit();
      expect(component.names()['conv-1']).toBe('Bob');
    });

    it('populates the unreadIds set from the service', async () => {
      messagesSpy.getUnreadConversationIds.and.returnValue(
        Promise.resolve(new Set(['conv-1', 'conv-2']))
      );
      await component.ngOnInit();
      expect(component.unreadIds().has('conv-1')).toBeTrue();
      expect(component.unreadIds().has('conv-2')).toBeTrue();
    });

    it('sets loading to false after conversations load', async () => {
      await component.ngOnInit();
      expect(component.loading()).toBeFalse();
    });

    it('calls getOtherUserProfile once per conversation', async () => {
      const convs = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })];
      messagesSpy.getConversations.and.returnValue(Promise.resolve(convs));
      await component.ngOnInit();
      expect(messagesSpy.getOtherUserProfile).toHaveBeenCalledTimes(2);
    });
  });

  // ── ngOnInit() – error path ────────────────────────────────────────────────

  describe('ngOnInit() – getConversations failure', () => {
    it('shows a toast error when getConversations throws', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.reject(new Error('network')));
      await component.ngOnInit();
      expect(toastSpy.error).toHaveBeenCalledWith(
        'No se pudieron cargar las conversaciones. Recarga la página.'
      );
    });

    it('still sets loading to false when getConversations throws', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.reject(new Error('network')));
      await component.ngOnInit();
      expect(component.loading()).toBeFalse();
    });

    it('leaves conversations empty when getConversations throws', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.reject(new Error('network')));
      await component.ngOnInit();
      expect(component.conversations()).toEqual([]);
    });
  });

  // ── ngOnInit() – inboxUpdate$ subscription ────────────────────────────────

  describe('ngOnInit() – inboxUpdate$ subscription', () => {
    it('prepends a new conversation when an update arrives for a new conversationId', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.resolve([]));
      await component.ngOnInit();

      inboxUpdate$.next({
        senderName: 'Carlos',
        preview: 'hola',
        conversationId: 'conv-new',
      });
      await fixture.whenStable();
      await Promise.resolve();

      expect(messagesSpy.getConversationById).toHaveBeenCalledWith('conv-new');
      expect(component.conversations()[0].id).toBe('conv-new');
      expect(component.conversations()[0].last_message).toBe('hola');
    });

    it('does not add a conversation the user cannot read', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.resolve([]));
      messagesSpy.getConversationById.and.returnValue(Promise.resolve(null));
      await component.ngOnInit();

      inboxUpdate$.next({ senderName: 'X', preview: 'spam', conversationId: 'conv-foreign' });
      await fixture.whenStable();
      await Promise.resolve();

      expect(component.conversations().length).toBe(0);
    });

    it('moves an existing conversation to the top when an update arrives', async () => {
      const older = makeConversation({ id: 'conv-old' });
      const newer = makeConversation({ id: 'conv-new', last_message_at: '2024-01-01T11:00:00Z' });
      messagesSpy.getConversations.and.returnValue(Promise.resolve([newer, older]));
      messagesSpy.getOtherUserProfile.and.returnValue(Promise.resolve('Alice'));
      await component.ngOnInit();

      inboxUpdate$.next({
        senderName: 'Sender',
        preview: 'ping',
        conversationId: 'conv-old',
      });

      expect(component.conversations()[0].id).toBe('conv-old');
    });

    it('adds the conversationId to unreadIds on update', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.resolve([]));
      await component.ngOnInit();

      inboxUpdate$.next({
        senderName: 'Diana',
        preview: 'hey',
        conversationId: 'conv-unread',
      });

      expect(component.unreadIds().has('conv-unread')).toBeTrue();
    });

    it('adds the sender name to the names map when not already present', async () => {
      messagesSpy.getConversations.and.returnValue(Promise.resolve([]));
      await component.ngOnInit();

      inboxUpdate$.next({
        senderName: 'Eva',
        preview: 'test',
        conversationId: 'conv-eva',
      });

      expect(component.names()['conv-eva']).toBe('Eva');
    });
  });

  // ── deleteConversation() ───────────────────────────────────────────────────

  describe('deleteConversation()', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      spyOn(window, 'confirm').and.returnValue(true);
    });

    it('calls event.preventDefault', async () => {
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect((event.preventDefault as jasmine.Spy)).toHaveBeenCalled();
    });

    it('calls event.stopPropagation', async () => {
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect((event.stopPropagation as jasmine.Spy)).toHaveBeenCalled();
    });

    it('does nothing further when the user cancels the confirm dialog', async () => {
      (window.confirm as jasmine.Spy).and.returnValue(false);
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(messagesSpy.deleteConversation).not.toHaveBeenCalled();
    });

    it('removes the conversation from the list on success', async () => {
      messagesSpy.deleteConversation.and.returnValue(Promise.resolve(null));
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(component.conversations().find(c => c.id === 'conv-1')).toBeUndefined();
    });

    it('removes the conversationId from unreadIds on success', async () => {
      messagesSpy.getUnreadConversationIds.and.returnValue(
        Promise.resolve(new Set(['conv-1']))
      );
      // Re-init to load the unread id
      await component.ngOnInit();
      expect(component.unreadIds().has('conv-1')).toBeTrue();

      messagesSpy.deleteConversation.and.returnValue(Promise.resolve(null));
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(component.unreadIds().has('conv-1')).toBeFalse();
    });

    it('shows a success toast after deleting', async () => {
      messagesSpy.deleteConversation.and.returnValue(Promise.resolve(null));
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(toastSpy.success).toHaveBeenCalledWith('Conversación eliminada.');
    });

    it('shows an error toast when deleteConversation returns an error string', async () => {
      messagesSpy.deleteConversation.and.returnValue(
        Promise.resolve('No tienes permisos')
      );
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'No se pudo borrar la conversación. Inténtalo de nuevo.'
      );
    });

    it('does not remove the conversation when deleteConversation returns an error string', async () => {
      messagesSpy.deleteConversation.and.returnValue(
        Promise.resolve('some error')
      );
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(component.conversations().find(c => c.id === 'conv-1')).toBeDefined();
    });

    it('shows an error toast when deleteConversation throws an exception', async () => {
      messagesSpy.deleteConversation.and.callFake(async () => {
        throw new Error('network error');
      });
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'No se pudo borrar la conversación. Inténtalo de nuevo.'
      );
    });

    it('calls deleteConversation with the correct id', async () => {
      const event = makeEvent();
      await component.deleteConversation('conv-1', event);
      expect(messagesSpy.deleteConversation).toHaveBeenCalledWith('conv-1');
    });

    it('only removes the targeted conversation, not others', async () => {
      const second = makeConversation({ id: 'conv-2', user1_id: 'x', user2_id: 'y' });
      messagesSpy.getConversations.and.returnValue(
        Promise.resolve([defaultConversation, second])
      );
      messagesSpy.getOtherUserProfile.and.returnValue(Promise.resolve('Someone'));
      await component.ngOnInit();

      const event = makeEvent();
      await component.deleteConversation('conv-1', event);

      expect(component.conversations().length).toBe(1);
      expect(component.conversations()[0].id).toBe('conv-2');
    });
  });

  describe('push notification prompt', () => {
    it('shows nothing when notifications are already granted', () => {
      expect(component.pushPrompt()).toBe('none');
    });

    it('enablePush() hides the prompt and confirms when the user grants permission', async () => {
      component.pushPrompt.set('ask');
      await component.enablePush();
      expect(pushMock.requestAndSubscribe).toHaveBeenCalledWith('user-1');
      expect(component.pushPrompt()).toBe('none');
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('enablePush() switches to the "blocked" hint when the user denies permission', async () => {
      component.pushPrompt.set('ask');
      pushMock.requestAndSubscribe.and.resolveTo('denied');
      await component.enablePush();
      expect(component.pushPrompt()).toBe('denied');
    });

    it('enablePush() keeps the prompt and shows an error when subscribing fails', async () => {
      component.pushPrompt.set('ask');
      pushMock.requestAndSubscribe.and.resolveTo('error');
      await component.enablePush();
      expect(component.pushPrompt()).toBe('ask');
      expect(toastSpy.error).toHaveBeenCalled();
    });
  });
});
