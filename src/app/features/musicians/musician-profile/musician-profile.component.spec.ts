import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MusicianProfileComponent } from './musician-profile.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { Musician } from '../../../core/models';

// ---------------------------------------------------------------------------
// Supabase query-builder mock
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const fakeMusicianData: Musician = {
  id: 'm-1',
  user_id: 'owner-1',
  name: 'Test Musician',
  instrument: 'Guitar',
  genre: 'Rock',
  city: 'Madrid',
  description: 'A test musician',
  avatar_url: null,
  contact_email: null,
  availability_days: null,
  availability_slots: null,
  level: null,
  experience: null,
  influences: null,
  spotify_url: null,
  youtube_url: null,
  instagram_url: null,
  soundcloud_url: null,
  website_url: null,
  created_at: new Date().toISOString(),
};

describe('MusicianProfileComponent', () => {
  let component: MusicianProfileComponent;
  let supabaseSpy: any;
  let msgSvc: jasmine.SpyObj<MessagesService>;
  let favSvc: jasmine.SpyObj<FavoritesService>;
  let seoSpy: jasmine.SpyObj<SeoService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeMock: any;

  beforeEach(async () => {
    const musicianBuilder = mockBuilder({ data: fakeMusicianData, error: null });

    supabaseSpy = {
      auth: {
        getSession: jasmine.createSpy('getSession').and.returnValue(
          Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.callFake((table: string) => {
          if (table === 'musicians') return musicianBuilder;
          return mockBuilder({ data: null, error: null });
        }),
      },
    };

    msgSvc = jasmine.createSpyObj<MessagesService>('MessagesService', ['getOrCreateConversation']);
    favSvc = jasmine.createSpyObj<FavoritesService>('FavoritesService', ['isFavorite', 'toggle']);
    seoSpy = jasmine.createSpyObj<SeoService>('SeoService', ['setProfile', 'injectJsonLd', 'set']);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    routeMock = {
      snapshot: { paramMap: { get: jasmine.createSpy('get').and.returnValue('m-1') } },
    };

    await TestBed.configureTestingModule({
      imports: [MusicianProfileComponent],
      providers: [
        { provide: SupabaseService,  useValue: supabaseSpy },
        { provide: MessagesService,  useValue: msgSvc },
        { provide: FavoritesService, useValue: favSvc },
        { provide: SeoService,       useValue: seoSpy },
        { provide: ToastService,     useValue: toastSpy },
        { provide: Router,           useValue: routerSpy },
        { provide: ActivatedRoute,   useValue: routeMock },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(false), state: () => () => false } },
      ],
    })
    .overrideComponent(MusicianProfileComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(MusicianProfileComponent).componentInstance;
  });

  // ---------------------------------------------------------------------------
  // Helper: set up component state without going through ngOnInit
  // ---------------------------------------------------------------------------
  function setUpLoggedInUser(userId = 'user-1') {
    component.currentUserId.set(userId);
    component.musician.set(fakeMusicianData);
  }

  // -------------------------------------------------------------------------
  // toggleFav()
  // -------------------------------------------------------------------------

  it('1. toggleFav redirects to /auth/login when not logged in', async () => {
    component.currentUserId.set(null);
    component.musician.set(fakeMusicianData);
    await component.toggleFav();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(favSvc.toggle).not.toHaveBeenCalled();
  });

  it('2. toggleFav calls favSvc.toggle with correct entity type and id', async () => {
    favSvc.toggle.and.returnValue(Promise.resolve(true));
    setUpLoggedInUser();
    await component.toggleFav();
    expect(favSvc.toggle).toHaveBeenCalledWith('user-1', 'musician', 'm-1');
  });

  it('3. toggleFav sets isFav with the result of toggle', async () => {
    favSvc.toggle.and.returnValue(Promise.resolve(true));
    setUpLoggedInUser();
    component.isFav.set(false);
    await component.toggleFav();
    expect(component.isFav()).toBeTrue();
  });

  it('4. toggleFav calls toast.error on thrown exception', async () => {
    favSvc.toggle.and.returnValue(Promise.reject(new Error('network error')));
    setUpLoggedInUser();
    await component.toggleFav();
    expect(toastSpy.error).toHaveBeenCalledWith('No se pudo actualizar favoritos. Inténtalo de nuevo.');
  });

  it('5. toggleFav resets favLoading to false in finally', async () => {
    favSvc.toggle.and.returnValue(Promise.resolve(false));
    setUpLoggedInUser();
    await component.toggleFav();
    expect(component.favLoading()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // sendMessage()
  // -------------------------------------------------------------------------

  it('6. sendMessage redirects to /auth/login when not logged in', async () => {
    component.currentUserId.set(null);
    component.musician.set(fakeMusicianData);
    await component.sendMessage();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(msgSvc.getOrCreateConversation).not.toHaveBeenCalled();
  });

  it('7. sendMessage redirects to /inbox when userId equals musician owner user_id', async () => {
    component.currentUserId.set('owner-1');             // same as fakeMusicianData.user_id
    component.musician.set(fakeMusicianData);
    await component.sendMessage();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/inbox']);
    expect(msgSvc.getOrCreateConversation).not.toHaveBeenCalled();
  });

  it('8. sendMessage calls getOrCreateConversation with musician user_id and name', async () => {
    msgSvc.getOrCreateConversation.and.returnValue(Promise.resolve({ id: 'conv-99' }));
    setUpLoggedInUser('different-user');
    await component.sendMessage();
    expect(msgSvc.getOrCreateConversation).toHaveBeenCalledWith('owner-1', 'Test Musician');
  });

  it('9. sendMessage navigates to /inbox/:id on success', async () => {
    msgSvc.getOrCreateConversation.and.returnValue(Promise.resolve({ id: 'conv-99' }));
    setUpLoggedInUser('different-user');
    await component.sendMessage();
    expect(routerSpy.navigate).toHaveBeenCalledWith(
      ['/inbox', 'conv-99'],
      { state: { name: 'Test Musician' } }
    );
  });

  it('10. sendMessage sets msgError when result contains error property', async () => {
    msgSvc.getOrCreateConversation.and.returnValue(
      Promise.resolve({ error: 'No puedes enviarte mensajes a ti mismo.' })
    );
    setUpLoggedInUser('different-user');
    await component.sendMessage();
    expect(component.msgError()).toBe('No puedes enviarte mensajes a ti mismo.');
  });

  it('11. sendMessage sets msgError on thrown exception', async () => {
    msgSvc.getOrCreateConversation.and.returnValue(Promise.reject(new Error('network')));
    setUpLoggedInUser('different-user');
    await component.sendMessage();
    expect(component.msgError()).toBeTruthy();
  });

  it('12. sendMessage resets sending to false in finally', async () => {
    msgSvc.getOrCreateConversation.and.returnValue(Promise.resolve({ id: 'conv-99' }));
    setUpLoggedInUser('different-user');
    await component.sendMessage();
    expect(component.sending()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // ngOnInit() — basic path coverage
  // -------------------------------------------------------------------------

  it('13. ngOnInit sets musician signal with data from supabase', async () => {
    favSvc.isFavorite.and.returnValue(Promise.resolve(false));
    await component.ngOnInit();
    expect(component.musician()).toEqual(fakeMusicianData);
  });

  it('14. ngOnInit sets currentUserId from session', async () => {
    favSvc.isFavorite.and.returnValue(Promise.resolve(false));
    await component.ngOnInit();
    expect(component.currentUserId()).toBe('user-1');
  });

  it('15. ngOnInit sets loading to false after load (finally)', async () => {
    favSvc.isFavorite.and.returnValue(Promise.resolve(false));
    await component.ngOnInit();
    expect(component.loading()).toBeFalse();
  });

  it('16. ngOnInit calls seo.setProfile when musician data is available', async () => {
    favSvc.isFavorite.and.returnValue(Promise.resolve(false));
    await component.ngOnInit();
    expect(seoSpy.setProfile).toHaveBeenCalled();
  });

  it('17. ngOnInit calls toast.error when supabase throws an exception', async () => {
    supabaseSpy.client.from.and.throwError('DB error');
    await component.ngOnInit();
    expect(toastSpy.error).toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
  });

  it('18. ngOnInit sets loading to false when no id is present in route', async () => {
    routeMock.snapshot.paramMap.get.and.returnValue(null);
    await component.ngOnInit();
    expect(component.loading()).toBeFalse();
    expect(component.musician()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // shareLink()
  // -------------------------------------------------------------------------

  it('19. shareLink sets linkShared to true and resets after 2000 ms when navigator.share is unavailable', fakeAsync(async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    component.musician.set(fakeMusicianData);

    await component.shareLink();
    expect(component.linkShared()).toBeTrue();

    tick(2000);
    expect(component.linkShared()).toBeFalse();
  }));

  it('20. shareLink calls navigator.clipboard.writeText with the correct URL', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const clipSpy = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    component.musician.set(fakeMusicianData);

    await component.shareLink();

    const expectedUrl = `${window.location.origin}/musicians/m-1`;
    expect(clipSpy).toHaveBeenCalledWith(expectedUrl);
  });
});
