import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../../core/services/notifications.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { Notification as AppNotification } from '../../core/models';

const NOW = new Date();
const TODAY_ISO = NOW.toISOString();

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

  beforeEach(() => {
    notifSvcSpy = jasmine.createSpyObj<NotificationsService>('NotificationsService', [
      'getAll', 'markAllRead', 'deleteAll',
    ]);
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

    TestBed.configureTestingModule({
      providers: [
        NotificationsComponent,
        { provide: NotificationsService, useValue: notifSvcSpy },
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
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

  describe('typeIcon()', () => {
    it('returns "music" for application type', () => {
      expect(component.typeIcon('application')).toBe('music');
    });

    it('returns "star" for review type', () => {
      expect(component.typeIcon('review')).toBe('star');
    });

    it('returns "calendar" for booking type', () => {
      expect(component.typeIcon('booking')).toBe('calendar');
    });

    it('returns "bell" for unknown type', () => {
      expect(component.typeIcon('unknown')).toBe('bell');
    });
  });

  describe('getRoute()', () => {
    it('returns inbox with entity_id for message+conversation', () => {
      const n = makeNotif({ type: 'message', entity_type: 'conversation', entity_id: 'c1' });
      expect(component.getRoute(n)).toEqual(['/inbox', 'c1']);
    });

    it('returns /inbox when message has no entity', () => {
      const n = makeNotif({ type: 'message', entity_type: null, entity_id: null });
      expect(component.getRoute(n)).toEqual(['/inbox']);
    });

    it('returns correct route for musician entity', () => {
      const n = makeNotif({ type: 'review', entity_type: 'musician', entity_id: 'm1' });
      expect(component.getRoute(n)).toEqual(['/musicians', 'm1']);
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
  });
});
