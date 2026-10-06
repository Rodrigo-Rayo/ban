import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { EventDetailComponent } from './event-detail.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';

function mockBuilder(resolveValue: any = {}) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  ['select', 'eq', 'order'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

const EVENT = {
  id: 'ev1', title: 'Rock Fest', date: '2030-12-01', city: 'Madrid',
  description: 'A great event', genre: 'Rock', venue_name: 'Sala Caracol',
};

describe('EventDetailComponent', () => {
  let component: EventDetailComponent;
  let supabaseSpy: any;
  let routerSpy: jasmine.SpyObj<Router>;
  let favSvcSpy: jasmine.SpyObj<FavoritesService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let confirmSpy: jasmine.SpyObj<ConfirmService>;
  let eventImageAvailable: boolean;
  let eventAddressAvailable: boolean;

  beforeEach(() => {
    eventImageAvailable = false;
    eventAddressAvailable = false;
    supabaseSpy = {
      auth: {
        getSession: jasmine.createSpy('getSession').and.returnValue(
          Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.returnValue(mockBuilder({ data: EVENT })),
      },
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    favSvcSpy = jasmine.createSpyObj<FavoritesService>('FavoritesService', ['isFavorite', 'toggle']);
    favSvcSpy.isFavorite.and.returnValue(Promise.resolve(false));
    favSvcSpy.toggle.and.returnValue(Promise.resolve(true));
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    confirmSpy = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    confirmSpy.ask.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        EventDetailComponent,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
        { provide: FavoritesService, useValue: favSvcSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ConfirmService, useValue: confirmSpy },
        { provide: SeoService, useValue: { setEvent: () => {}, injectJsonLd: () => {} } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'ev1' } } } },
        { provide: MediaFeaturesService, useValue: { has: (f: string) => Promise.resolve(f === 'eventAddress' ? eventAddressAvailable : eventImageAvailable) } },
      ],
    });

    TestBed.overrideComponent(EventDetailComponent, { set: { imports: [], template: '<div></div>' } });
    component = TestBed.createComponent(EventDetailComponent).componentInstance;
  });

  describe('isPast computed', () => {
    it('is false for a future event', () => {
      component.event.set({ date: '2099-01-01' });
      expect(component.isPast()).toBeFalse();
    });

    it('is true for a past event', () => {
      component.event.set({ date: '2000-01-01' });
      expect(component.isPast()).toBeTrue();
    });

    it('is false when event is null', () => {
      component.event.set(null);
      expect(component.isPast()).toBeFalse();
    });
  });

  describe('toggleFav()', () => {
    it('navigates to login when no user', async () => {
      component.currentUserId.set(null);
      await component.toggleFav();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('sets isFav to result on success', async () => {
      component.currentUserId.set('u1');
      component.event.set(EVENT);
      favSvcSpy.toggle.and.returnValue(Promise.resolve(true));
      await component.toggleFav();
      expect(component.isFav()).toBeTrue();
      expect(component.favLoading()).toBeFalse();
    });

    it('shows error toast when toggle throws', async () => {
      component.currentUserId.set('u1');
      component.event.set(EVENT);
      favSvcSpy.toggle.and.callFake(async () => { throw new Error('fail'); });
      await component.toggleFav();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.favLoading()).toBeFalse();
    });
  });

  describe('owner actions', () => {
    const OWN = { ...EVENT, user_id: 'u1' };

    it('isOwner is true only for the event creator', () => {
      component.event.set(OWN);
      component.currentUserId.set('u1');
      expect(component.isOwner()).toBeTrue();
      component.currentUserId.set('u2');
      expect(component.isOwner()).toBeFalse();
    });

    it('owner cannot favorite their own event', async () => {
      component.event.set(OWN);
      component.currentUserId.set('u1');
      await component.toggleFav();
      expect(favSvcSpy.toggle).not.toHaveBeenCalled();
    });

    it('deleteEvent asks for confirmation, deletes and goes back to the agenda', async () => {
      const builder = mockBuilder({ error: null });
      builder.delete = jasmine.createSpy('delete').and.returnValue(builder);
      supabaseSpy.client.from.and.returnValue(builder);
      component.event.set(OWN);
      component.currentUserId.set('u1');
      await component.deleteEvent();
      expect(confirmSpy.ask).toHaveBeenCalled();
      expect(builder.delete).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/search'], { queryParams: { tab: 'events' } });
    });

    it('deleteEvent does nothing when the user cancels', async () => {
      confirmSpy.ask.and.resolveTo(false);
      component.event.set(OWN);
      component.currentUserId.set('u1');
      await component.deleteEvent();
      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('deleteEvent does nothing for a non-owner', async () => {
      component.event.set(OWN);
      component.currentUserId.set('u2');
      await component.deleteEvent();
      expect(confirmSpy.ask).not.toHaveBeenCalled();
    });
  });

  describe('date formatting', () => {
    it('formats the long date and the time like the rest of the app', () => {
      expect(component.longDate('2026-08-21')).toBe('viernes, 21 de agosto de 2026');
      expect(component.time('21:00:00')).toBe('21:00');
    });
  });

  describe('shareLink()', () => {
    it('copies to clipboard and sets linkShared when native share unavailable', fakeAsync(async () => {
      component.event.set(EVENT);
      // navigator.share is read-only in recent Chrome: shadow it on the instance.
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());

      await component.shareLink();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        jasmine.stringContaining('/events/ev1')
      );
      expect(component.linkShared()).toBeTrue();

      tick(2000);
      expect(component.linkShared()).toBeFalse();
    }));

    it('does nothing when event is null', async () => {
      component.event.set(null);
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      await component.shareLink();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('ngOnInit()', () => {
    it('loads event and sets currentUserId', async () => {
      await component.ngOnInit();
      expect(component.event()).toEqual(EVENT as any);
      expect(component.currentUserId()).toBe('u1');
      expect(component.loading()).toBeFalse();
    });

    it('does not request image_url while the column does not exist (SQL not run)', async () => {
      const builder = mockBuilder({ data: EVENT });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.ngOnInit();
      expect(builder.select.calls.first().args[0]).not.toContain('image_url');
      expect(component.posterUrl()).toBeNull();
    });

    it('requests image_url once available and shows the poster', async () => {
      eventImageAvailable = true;
      const builder = mockBuilder({ data: { ...EVENT, image_url: 'https://cdn.test/media/u1/events/p.jpg' } });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.ngOnInit();
      expect(builder.select.calls.first().args[0]).toContain('image_url');
      expect(component.posterUrl()).toBe('https://cdn.test/media/u1/events/p.jpg');
      component.posterError.set(true);
      expect(component.posterUrl()).toBeNull();
    });

    it('does not request address while the column does not exist', async () => {
      const builder = mockBuilder({ data: EVENT });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.ngOnInit();
      expect(builder.select.calls.first().args[0]).not.toContain('address');
    });

    it('requests address once available and uses it for "Cómo llegar"', async () => {
      eventAddressAvailable = true;
      const builder = mockBuilder({ data: { ...EVENT, venue: 'Sala Caracol', address: 'C/ Bernardino Obregón 18' } });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.ngOnInit();
      expect(builder.select.calls.first().args[0]).toContain('address');
      expect(new URL(component.directionsUrl()).searchParams.get('query'))
        .toBe('Sala Caracol, C/ Bernardino Obregón 18, Madrid, España');
    });

    it('"Cómo llegar" falls back to venue and province for events without address', () => {
      component.event.set({ ...EVENT, venue: 'Sala Caracol' });
      expect(new URL(component.directionsUrl()).searchParams.get('query')).toBe('Sala Caracol, Madrid, España');
    });

    it('shows error toast on exception', async () => {
      supabaseSpy.client.from.and.callFake(() => { throw new Error('fail'); });
      await component.ngOnInit();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.loading()).toBeFalse();
    });
  });
});
