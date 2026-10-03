import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GearDetailComponent } from './gear-detail.component';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SeoService } from '../../../core/services/seo.service';

function mockBuilder(resolveValue: { data?: any; error?: any } = {}) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'or', 'in', 'order',
   'limit', 'range', 'filter', 'not'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  b.single = jasmine.createSpy('single').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

const LISTING = {
  id: 'l1', user_id: 'u1', title: 'Guitarra', price: 300, city: 'Madrid',
  category: 'Guitarras', condition: 'good', status: 'active',
  seller_name: 'Juan', seller_profile_type: 'musician', seller_profile_id: 'p1',
  images: ['a.jpg', 'b.jpg'],
};

describe('GearDetailComponent', () => {
  let component: GearDetailComponent;
  let supabaseSpy: any;
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let messagesSpy: jasmine.SpyObj<MessagesService>;
  let confirmSpy: jasmine.SpyObj<ConfirmService>;

  beforeEach(() => {
    supabaseSpy = {
      auth: {
        getUser: jasmine.createSpy('getUser').and.returnValue(
          Promise.resolve({ data: { user: { id: 'u1' } } })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.returnValue(mockBuilder({ data: LISTING, error: null })),
      },
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    confirmSpy = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    confirmSpy.ask.and.resolveTo(true);
    messagesSpy = jasmine.createSpyObj<MessagesService>('MessagesService', ['getOrCreateConversation']);

    TestBed.configureTestingModule({
      providers: [
        GearDetailComponent,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: MessagesService, useValue: messagesSpy },
        { provide: ConfirmService, useValue: confirmSpy },
        { provide: SeoService, useValue: { setListing: () => {} } },
        { provide: AuthService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'l1' } } },
        },
      ],
    });

    TestBed.overrideComponent(GearDetailComponent, { set: { imports: [], template: '<div></div>' } });
    component = TestBed.createComponent(GearDetailComponent).componentInstance;
  });

  describe('isOwner getter', () => {
    it('returns true when user.id === listing.user_id', () => {
      component.currentUser.set({ id: 'u1' } as any);
      component.listing.set({ ...LISTING, user_id: 'u1' } as any);
      expect(component.isOwner).toBeTrue();
    });

    it('returns false when ids differ', () => {
      component.currentUser.set({ id: 'u2' } as any);
      component.listing.set({ ...LISTING, user_id: 'u1' } as any);
      expect(component.isOwner).toBeFalse();
    });

    it('returns false when currentUser is null', () => {
      component.currentUser.set(null);
      component.listing.set(LISTING as any);
      expect(component.isOwner).toBeFalse();
    });
  });

  describe('conditionLabel()', () => {
    it('shows "Bueno" for legacy "bueno" and for "good"', () => {
      expect(component.conditionLabel('bueno')).toBe('Bueno');
      expect(component.conditionLabel('good')).toBe('Bueno');
      expect(component.conditionLabel('muy bueno')).toBe('Muy bueno');
    });
  });

  describe('profileRoute()', () => {
    it('returns correct path for musician type', () => {
      component.listing.set({ ...LISTING, seller_profile_type: 'musician', seller_profile_id: 'p1' } as any);
      expect(component.profileRoute()).toEqual(['/musicians', 'p1']);
    });

    it('returns correct path for rehearsal type', () => {
      component.listing.set({ ...LISTING, seller_profile_type: 'rehearsal', seller_profile_id: 'p2' } as any);
      expect(component.profileRoute()).toEqual(['/rehearsal', 'p2']);
    });

    it('returns null when no seller_profile_id', () => {
      component.listing.set({ ...LISTING, seller_profile_id: null } as any);
      expect(component.profileRoute()).toBeNull();
    });

    it('returns null when listing is null', () => {
      component.listing.set(null);
      expect(component.profileRoute()).toBeNull();
    });

    it('returns null for unknown seller type', () => {
      component.listing.set({ ...LISTING, seller_profile_type: 'unknown', seller_profile_id: 'p1' } as any);
      expect(component.profileRoute()).toBeNull();
    });
  });

  describe('markAsSold()', () => {
    beforeEach(() => {
      component.currentUser.set({ id: 'u1' } as any);
      component.listing.set(LISTING as any);
    });

    it('navigates to login when no user', async () => {
      component.currentUser.set(null);
      await component.markAsSold();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('does nothing if user cancels confirm', async () => {
      confirmSpy.ask.and.resolveTo(false);
      await component.markAsSold();
      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('updates listing status to sold on success', async () => {
      confirmSpy.ask.and.resolveTo(true);
      const builder = mockBuilder({ error: null });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.markAsSold();
      expect(component.listing()?.status).toBe('sold');
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('explains that the listing disappears from the shop but can be relisted', async () => {
      supabaseSpy.client.from.and.returnValue(mockBuilder({ error: null }));
      await component.markAsSold();
      expect(confirmSpy.ask.calls.mostRecent().args[0].message).toContain('Dejará de aparecer en la Tienda');
    });

    it('relist() puts a sold listing back on sale', async () => {
      component.listing.set({ ...LISTING, status: 'sold' } as any);
      supabaseSpy.client.from.and.returnValue(mockBuilder({ error: null }));
      await component.relist();
      expect(component.listing()?.status).toBe('active');
    });

    it('shows error toast on supabase error', async () => {
      confirmSpy.ask.and.resolveTo(true);
      const builder = mockBuilder({ error: { message: 'db error' } });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.markAsSold();
      expect(toastSpy.error).toHaveBeenCalled();
    });
  });

  describe('deleteListing()', () => {
    beforeEach(() => {
      component.currentUser.set({ id: 'u1' } as any);
      component.listing.set(LISTING as any);
    });

    it('navigates to login when no user', async () => {
      component.currentUser.set(null);
      await component.deleteListing();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('does nothing if user cancels confirm', async () => {
      confirmSpy.ask.and.resolveTo(false);
      await component.deleteListing();
      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('navigates to /shop on success', async () => {
      confirmSpy.ask.and.resolveTo(true);
      const builder = mockBuilder({ error: null });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.deleteListing();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/shop']);
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('shows error and clears deleting on supabase error', async () => {
      confirmSpy.ask.and.resolveTo(true);
      const builder = mockBuilder({ error: { message: 'fail' } });
      supabaseSpy.client.from.and.returnValue(builder);
      await component.deleteListing();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.deleting()).toBeFalse();
    });
  });

  describe('contactSeller()', () => {
    beforeEach(() => {
      component.currentUser.set({ id: 'u1' } as any);
      component.listing.set(LISTING as any);
    });

    it('navigates to login when no user', async () => {
      component.currentUser.set(null);
      await component.contactSeller();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('no-ops if already contacting', async () => {
      component.contacting.set(true);
      await component.contactSeller();
      expect(messagesSpy.getOrCreateConversation).not.toHaveBeenCalled();
    });

    it('navigates to inbox on success', async () => {
      messagesSpy.getOrCreateConversation.and.returnValue(Promise.resolve({ id: 'conv1' } as any));
      await component.contactSeller();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/inbox', 'conv1']);
    });

    it('shows toast when getOrCreate returns error', async () => {
      messagesSpy.getOrCreateConversation.and.returnValue(Promise.resolve({ error: 'Chat error' } as any));
      await component.contactSeller();
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('shows toast when result is null', async () => {
      messagesSpy.getOrCreateConversation.and.returnValue(Promise.resolve(null as any));
      await component.contactSeller();
      expect(toastSpy.error).toHaveBeenCalled();
    });
  });

  describe('prevImage() / nextImage()', () => {
    beforeEach(() => {
      component.listing.set(LISTING as any); // 2 images
      component.currentImageIdx.set(0);
    });

    it('nextImage increments index', () => {
      component.nextImage();
      expect(component.currentImageIdx()).toBe(1);
    });

    it('nextImage wraps from last to first', () => {
      component.currentImageIdx.set(1);
      component.nextImage();
      expect(component.currentImageIdx()).toBe(0);
    });

    it('prevImage wraps from first to last', () => {
      component.prevImage();
      expect(component.currentImageIdx()).toBe(1);
    });

    it('prevImage decrements index', () => {
      component.currentImageIdx.set(1);
      component.prevImage();
      expect(component.currentImageIdx()).toBe(0);
    });

    it('prevImage is no-op when no images', () => {
      component.listing.set({ ...LISTING, images: [] } as any);
      component.prevImage();
      expect(component.currentImageIdx()).toBe(0);
    });

    it('nextImage is no-op when no images', () => {
      component.listing.set({ ...LISTING, images: [] } as any);
      component.nextImage();
      expect(component.currentImageIdx()).toBe(0);
    });
  });
});
