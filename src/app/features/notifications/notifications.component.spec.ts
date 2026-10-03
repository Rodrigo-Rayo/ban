import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../../core/services/notifications.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Notification as AppNotification } from '../../core/models';

const NOW = new Date();
const TODAY_ISO = NOW.toISOString();
const UUID_A = '11111111-2222-4333-8444-555555555555';

function makeNotif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    user_id: 'u1',
    type: 'system',
    title: 'Test',
    body: 'Body',
    read: false,
    entity_type: null,
    entity_id: null,
    created_at: TODAY_ISO,
    ...overrides,
  } as any;
}

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let notifSvcSpy: jasmine.SpyObj<NotificationsService>;
  let supabaseSpy: any;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let confirmSpy: jasmine.SpyObj<ConfirmService>;

  beforeEach(() => {
    notifSvcSpy = jasmine.createSpyObj<NotificationsService>('NotificationsService', [
      'getAll', 'markAllRead', 'deleteAll', 'markRead',
    ]);
    notifSvcSpy.markRead.and.returnValue(Promise.resolve());
    notifSvcSpy.getAll.and.returnValue(Promise.resolve([]));
    notifSvcSpy.markAllRead.and.returnValue(Promise.resolve());
    notifSvcSpy.deleteAll.and.returnValue(Promise.resolve());

    supabaseSpy = {
      auth: {
        getSession: jasmine.createSpy('getSession').and.returnValue(
          Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
        ),
      },
    };

    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    confirmSpy = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    confirmSpy.ask.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        NotificationsComponent,
        { provide: NotificationsService, useValue: notifSvcSpy },
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ConfirmService, useValue: confirmSpy },
        { provide: Router, useValue: {} },
      ],
    });

    TestBed.overrideComponent(NotificationsComponent, { set: { imports: [], template: '<div></div>' } });
    component = TestBed.createComponent(NotificationsComponent).componentInstance;
  });

  describe('hasUnread computed', () => {
    it('is true when any notification is unread', () => {
      component.notifications.set([makeNotif({ read: false })]);
      expect(component.hasUnread()).toBeTrue();
    });

    it('is false when all notifications are read', () => {
      component.notifications.set([makeNotif({ read: true })]);
      expect(component.hasUnread()).toBeFalse();
    });

    it('is false when notifications list is empty', () => {
      component.notifications.set([]);
      expect(component.hasUnread()).toBeFalse();
    });
  });

  describe('unreadTotal computed', () => {
    it('counts only unread notifications', () => {
      component.notifications.set([makeNotif({ id: 'a', read: false }), makeNotif({ id: 'b', read: true }), makeNotif({ id: 'c', read: false })]);
      expect(component.unreadTotal()).toBe(2);
    });
  });

  describe('groupedNotifications computed', () => {
    it('groups a notification from today into the Hoy bucket', () => {
      component.notifications.set([makeNotif({ created_at: new Date().toISOString() })]);
      const groups = component.groupedNotifications();
      const todayGroup = groups.find(g => g.label === 'Hoy');
      expect(todayGroup).toBeTruthy();
      expect(todayGroup!.items.length).toBe(1);
    });

    it('groups an old notification into the Anteriores bucket', () => {
      const old = new Date();
      old.setDate(old.getDate() - 30);
      component.notifications.set([makeNotif({ created_at: old.toISOString() })]);
      const groups = component.groupedNotifications();
      const oldGroup = groups.find(g => g.label === 'Anteriores');
      expect(oldGroup).toBeTruthy();
    });

    it('filters out empty groups', () => {
      component.notifications.set([]);
      expect(component.groupedNotifications().length).toBe(0);
    });
  });

  describe('markAllRead()', () => {
    it('does nothing when userId is null', async () => {
      component.userId.set(null);
      await component.markAllRead();
      expect(notifSvcSpy.markAllRead).not.toHaveBeenCalled();
    });

    it('sets all notifications to read', async () => {
      component.userId.set('u1');
      component.notifications.set([makeNotif({ read: false }), makeNotif({ id: 'n2', read: false })]);
      await component.markAllRead();
      expect(component.notifications().every(n => n.read)).toBeTrue();
      expect(notifSvcSpy.markAllRead).toHaveBeenCalledWith('u1');
    });

    it('restores unread state when markAllRead throws', async () => {
      component.userId.set('u1');
      component.notifications.set([makeNotif({ read: false })]);
      notifSvcSpy.markAllRead.and.callFake(async () => { throw new Error('fail'); });
      await component.markAllRead();
      expect(component.notifications()[0].read).toBeFalse();
    });

    it('shows error toast when markAllRead throws', async () => {
      component.userId.set('u1');
      component.notifications.set([makeNotif()]);
      notifSvcSpy.markAllRead.and.callFake(async () => { throw new Error('fail'); });
      await component.markAllRead();
      expect(toastSpy.error).toHaveBeenCalled();
    });
  });

  describe('deleteAll()', () => {
    it('does nothing when userId is null', async () => {
      component.userId.set(null);
      await component.deleteAll();
      expect(notifSvcSpy.deleteAll).not.toHaveBeenCalled();
    });

    it('asks for confirmation with the "Eliminar todas" label', async () => {
      component.userId.set('u1');
      await component.deleteAll();
      expect(confirmSpy.ask).toHaveBeenCalledWith(jasmine.objectContaining({ confirmLabel: 'Eliminar todas', danger: true }));
    });

    it('keeps everything when the user cancels', async () => {
      component.userId.set('u1');
      component.notifications.set([makeNotif()]);
      confirmSpy.ask.and.returnValue(Promise.resolve(false));
      await component.deleteAll();
      expect(notifSvcSpy.deleteAll).not.toHaveBeenCalled();
      expect(component.notifications().length).toBe(1);
    });

    it('clears notifications on success', async () => {
      component.userId.set('u1');
      component.notifications.set([makeNotif()]);
      await component.deleteAll();
      expect(component.notifications().length).toBe(0);
      expect(component.deleting()).toBeFalse();
    });

    it('shows error toast when deleteAll throws', async () => {
      component.userId.set('u1');
      notifSvcSpy.deleteAll.and.callFake(async () => { throw new Error('fail'); });
      await component.deleteAll();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.deleting()).toBeFalse();
    });
  });

  describe('getRoute()', () => {
    it('returns inbox with entity_id for message+conversation', () => {
      const n = makeNotif({ type: 'message', entity_type: 'conversation', entity_id: UUID_A });
      expect(component.getRoute(n)).toEqual(['/inbox', UUID_A]);
    });

    it('returns /inbox when message has no entity', () => {
      const n = makeNotif({ type: 'message', entity_type: null, entity_id: null });
      expect(component.getRoute(n)).toEqual(['/inbox']);
    });

    it('returns correct route for musician entity', () => {
      const n = makeNotif({ type: 'review', entity_type: 'musician', entity_id: UUID_A });
      expect(component.getRoute(n)).toEqual(['/musicians', UUID_A]);
    });

    it('returns null when entity_id is not a UUID', () => {
      const n = makeNotif({ type: 'review', entity_type: 'musician', entity_id: '../admin' });
      expect(component.getRoute(n)).toBeNull();
    });

    it('falls back to /inbox for a message with a malformed conversation id', () => {
      const n = makeNotif({ type: 'message', entity_type: 'conversation', entity_id: 'x/y' });
      expect(component.getRoute(n)).toEqual(['/inbox']);
    });

    it('does not resolve inherited object keys as entity types', () => {
      const n = makeNotif({ type: 'system', entity_type: 'constructor', entity_id: UUID_A });
      expect(component.getRoute(n)).toBeNull();
    });

    it('returns null when entity_type is unknown', () => {
      const n = makeNotif({ type: 'system', entity_type: 'unknown', entity_id: 'x1' });
      expect(component.getRoute(n)).toBeNull();
    });

    it('returns null when entity_type is null', () => {
      const n = makeNotif({ type: 'system', entity_type: null, entity_id: null });
      expect(component.getRoute(n)).toBeNull();
    });
  });

  describe('getRoute() for every producer', () => {
    const cases: [string, string, string][] = [
      ['application', 'band', '/bands'],
      ['favorite', 'musician', '/musicians'],
      ['favorite', 'band', '/bands'],
      ['favorite', 'venue', '/venues'],
      ['favorite', 'teacher', '/teachers'],
      ['favorite', 'rehearsal', '/rehearsal'],
      ['booking', 'teacher', '/teachers'],
    ];
    cases.forEach(([type, entityType, base]) => {
      it(`routes ${type} on a ${entityType} to ${base}/:id`, () => {
        const n = makeNotif({ type: type as AppNotification['type'], entity_type: entityType, entity_id: UUID_A });
        expect(component.getRoute(n)).toEqual([base, UUID_A]);
      });
    });
  });

  describe('iconFor()', () => {
    it('gives each type its own icon and falls back to the bell', () => {
      expect(component.iconFor(makeNotif({ type: 'favorite' }))).toBe('heart');
      expect(component.iconFor(makeNotif({ type: 'booking' }))).toBe('book-open');
      expect(component.iconFor(makeNotif({ type: 'application' }))).toBe('mic');
      expect(component.iconFor(makeNotif({ type: 'rsvp' }))).toBe('calendar');
      expect(component.iconFor(makeNotif({ type: 'review' }))).toBe('star');
      expect(component.iconFor(makeNotif({ type: 'system' }))).toBe('bell');
      expect(component.iconFor(makeNotif({ type: 'toString' as AppNotification['type'] }))).toBe('bell');
    });
  });

  describe('open()', () => {
    it('marks an unread notification as read locally and on the server', () => {
      component.userId.set('u1');
      const n = makeNotif({ id: 'n1', read: false });
      component.notifications.set([n, makeNotif({ id: 'n2', read: false })]);
      component.open(n);
      expect(component.notifications().find(x => x.id === 'n1')!.read).toBeTrue();
      expect(component.notifications().find(x => x.id === 'n2')!.read).toBeFalse();
      expect(notifSvcSpy.markRead).toHaveBeenCalledWith('u1', 'n1');
    });

    it('does nothing for an already-read notification', () => {
      component.userId.set('u1');
      component.open(makeNotif({ read: true }));
      expect(notifSvcSpy.markRead).not.toHaveBeenCalled();
    });

    it('keeps the read state when the server call fails', async () => {
      component.userId.set('u1');
      notifSvcSpy.markRead.and.returnValue(Promise.reject(new Error('x')));
      const n = makeNotif({ id: 'n1', read: false });
      component.notifications.set([n]);
      component.open(n);
      await Promise.resolve();
      expect(component.notifications()[0].read).toBeTrue();
      expect(toastSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('ngOnInit()', () => {
    it('loads and sets notifications', async () => {
      const notifs = [makeNotif()];
      notifSvcSpy.getAll.and.returnValue(Promise.resolve(notifs));
      await component.ngOnInit();
      expect(component.notifications()).toEqual(notifs);
      expect(component.loading()).toBeFalse();
    });

    it('sets loading false when no session', async () => {
      supabaseSpy.auth.getSession.and.returnValue(
        Promise.resolve({ data: { session: null } })
      );
      await component.ngOnInit();
      expect(component.loading()).toBeFalse();
      expect(notifSvcSpy.getAll).not.toHaveBeenCalled();
    });

    it('shows error toast when getAll throws', async () => {
      notifSvcSpy.getAll.and.callFake(async () => { throw new Error('fail'); });
      await component.ngOnInit();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.loading()).toBeFalse();
    });

    it('calls markAllRead after loading notifications', async () => {
      notifSvcSpy.getAll.and.returnValue(Promise.resolve([makeNotif()]));
      await component.ngOnInit();
      expect(notifSvcSpy.markAllRead).toHaveBeenCalledWith('u1');
    });

    it('does not show a load error when only markAllRead fails', async () => {
      notifSvcSpy.getAll.and.returnValue(Promise.resolve([makeNotif()]));
      notifSvcSpy.markAllRead.and.callFake(async () => { throw new Error('fail'); });
      await component.ngOnInit();
      expect(toastSpy.error).not.toHaveBeenCalled();
      expect(component.notifications().length).toBe(1);
    });
  });
});
