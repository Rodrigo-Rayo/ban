import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FeedComponent, mergeSeBusca } from './feed.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { VacanciesService } from '../../core/services/vacancies.service';
import { Post, PostType } from '../../core/models';

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
// Test helpers
// ---------------------------------------------------------------------------
function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    user_id: 'u1',
    type: 'musician_seeking_band' as PostType,
    text: 'Looking for a band',
    city: 'Madrid',
    instrument: 'Guitar',
    genre: 'Rock',
    author_name: 'Test User',
    author_profile_type: 'musician',
    author_profile_id: 'profile-1',
    created_at: new Date().toISOString(),
    ...overrides,
  } as Post;
}

describe('FeedComponent', () => {
  let component: FeedComponent;
  let supabaseSpy: any;
  let authSpy: any;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let seoSpy: jasmine.SpyObj<SeoService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let locationSpy: jasmine.SpyObj<Location>;
  let routeMock: any;
  let fromBuilder: any;
  let vacanciesSpy: { listOpen: jasmine.Spy };

  beforeEach(async () => {
    fromBuilder = mockBuilder({ data: [], error: null });
    vacanciesSpy = { listOpen: jasmine.createSpy('listOpen').and.resolveTo([]) };

    supabaseSpy = {
      auth: {
        getUser: jasmine.createSpy('getUser').and.returnValue(
          Promise.resolve({ data: { user: { id: 'u1', email: 'test@test.com' } } })
        ),
      },
      client: {
        from: jasmine.createSpy('from').and.returnValue(fromBuilder),
        rpc: jasmine.createSpy('rpc').and.returnValue(Promise.resolve({ data: 'Usuario Test', error: null })),
      },
    };

    authSpy = {
      loadUserProfile: jasmine.createSpy('loadUserProfile').and.returnValue(Promise.resolve()),
      userProfileData: jasmine.createSpy('userProfileData').and.returnValue(null),
      userProfileType: jasmine.createSpy('userProfileType').and.returnValue(''),
    };

    toastSpy   = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    seoSpy     = jasmine.createSpyObj<SeoService>('SeoService', ['set', 'setProfile', 'injectJsonLd']);
    routerSpy  = jasmine.createSpyObj<Router>('Router', ['navigate']);
    locationSpy = jasmine.createSpyObj<Location>('Location', ['back']);

    routeMock = {
      snapshot: {
        queryParamMap: { get: jasmine.createSpy('get').and.returnValue(null) },
      },
    };

    await TestBed.configureTestingModule({
      imports: [FeedComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthService,     useValue: authSpy },
        { provide: ToastService,    useValue: toastSpy },
        { provide: SeoService,      useValue: seoSpy },
        { provide: Router,          useValue: routerSpy },
        { provide: Location,        useValue: locationSpy },
        { provide: ActivatedRoute,  useValue: routeMock },
        { provide: VacanciesService, useValue: vacanciesSpy },
      ],
    })
    .overrideComponent(FeedComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(FeedComponent).componentInstance;
  });

  // -------------------------------------------------------------------------
  // loadPosts()
  // -------------------------------------------------------------------------

  it('1. loadPosts calls supabase.client.from("posts")', async () => {
    await component.loadPosts();
    expect(supabaseSpy.client.from).toHaveBeenCalledWith('posts');
  });

  it('2. loadPosts sets posts signal with returned data', async () => {
    const posts = [makePost()];
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: posts, error: null }));
    await component.loadPosts();
    expect(component.posts()).toEqual(posts);
  });

  it('3. loadPosts sets hasMore true when data.length equals PAGE_SIZE (20)', async () => {
    const posts = Array.from({ length: 20 }, (_, i) => makePost({ id: `p${i}` }));
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: posts, error: null }));
    await component.loadPosts();
    expect(component.hasMore()).toBeTrue();
  });

  it('4. loadPosts sets hasMore false when data.length is less than PAGE_SIZE', async () => {
    const posts = [makePost()];
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: posts, error: null }));
    await component.loadPosts();
    expect(component.hasMore()).toBeFalse();
  });

  it('5. loadPosts sets error signal when supabase returns an error', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'DB error' } }));
    await component.loadPosts();
    expect(component.error()).toBeTruthy();
  });

  it('6. loadPosts always resets loading to false (finally)', async () => {
    await component.loadPosts();
    expect(component.loading()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // submitPost()
  // -------------------------------------------------------------------------

  it('7. submitPost does nothing when text is empty', async () => {
    component.newPost.text = '   ';
    await component.submitPost();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('8. submitPost does nothing when text exceeds MAX_POST_LENGTH', async () => {
    component.newPost.text = 'x'.repeat(component.MAX_POST_LENGTH + 1);
    await component.submitPost();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('9. submitPost navigates to /auth/login when no current user', async () => {
    component.newPost.text = 'Looking for band';
    component.currentUser.set(null);
    await component.submitPost();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('10. submitPost calls supabase insert with user_id and text', async () => {
    const insertBuilder = mockBuilder({ data: null, error: null });
    supabaseSpy.client.from.and.returnValue(insertBuilder);
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(supabaseSpy.client.from).toHaveBeenCalledWith('posts');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      jasmine.objectContaining({ user_id: 'u1', text: 'Looking for band' })
    );
  });

  it('11. submitPost resets newPost.text to empty string on success', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(component.newPost.text).toBe('');
  });

  it('12. submitPost sets showForm to false on success', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.showForm.set(true);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(component.showForm()).toBeFalse();
  });

  it('13. submitPost calls toast.success on successful insert', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(toastSpy.success).toHaveBeenCalledWith('Anuncio publicado.');
  });

  it('14. submitPost calls toast.error when supabase insert returns error', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'insert failed' } }));
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(toastSpy.error).toHaveBeenCalledWith('No se pudo publicar. Intenta de nuevo.');
  });

  it('15. submitPost resets submitting to false in finally', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1', email: 'test@test.com' } as any);
    component.newPost.text = 'Looking for band';
    await component.submitPost();
    expect(component.submitting()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // deletePost()
  // -------------------------------------------------------------------------

  it('16. deletePost navigates to /auth/login when no current user', async () => {
    component.currentUser.set(null);
    await component.deletePost('post-1');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('17. deletePost does nothing when user cancels confirm dialog', async () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.currentUser.set({ id: 'u1' } as any);
    await component.deletePost('post-1');
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('18. deletePost removes post from list on success', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1' } as any);
    component.posts.set([makePost({ id: 'post-1' }), makePost({ id: 'post-2' })]);
    await component.deletePost('post-1');
    expect(component.posts().length).toBe(1);
    expect(component.posts()[0].id).toBe('post-2');
  });

  it('19. deletePost calls toast.success on successful delete', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: null }));
    component.currentUser.set({ id: 'u1' } as any);
    component.posts.set([makePost()]);
    await component.deletePost('post-1');
    expect(toastSpy.success).toHaveBeenCalledWith('Anuncio eliminado.');
  });

  it('20. deletePost calls toast.error when supabase returns error', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'delete failed' } }));
    component.currentUser.set({ id: 'u1' } as any);
    component.posts.set([makePost()]);
    await component.deletePost('post-1');
    expect(toastSpy.error).toHaveBeenCalledWith('No se pudo eliminar.');
  });

  it('21. deletePost calls toast.error on thrown exception', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    supabaseSpy.client.from.and.throwError('Unexpected');
    component.currentUser.set({ id: 'u1' } as any);
    await component.deletePost('post-1');
    expect(toastSpy.error).toHaveBeenCalledWith('No se pudo eliminar el anuncio.');
  });

  // -------------------------------------------------------------------------
  // cancelOrToggleForm()
  // -------------------------------------------------------------------------

  it('22. cancelOrToggleForm calls location.back() when formOnly is true', () => {
    component.formOnly.set(true);
    component.cancelOrToggleForm();
    expect(locationSpy.back).toHaveBeenCalled();
  });

  it('23. cancelOrToggleForm toggles showForm when not in formOnly mode', () => {
    component.formOnly.set(false);
    component.showForm.set(false);
    component.cancelOrToggleForm();
    expect(component.showForm()).toBeTrue();
    component.cancelOrToggleForm();
    expect(component.showForm()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // loadMore()
  // -------------------------------------------------------------------------

  it('24. loadMore does nothing when loadingMore is true', async () => {
    component.loadingMore.set(true);
    supabaseSpy.client.from.calls.reset();
    await component.loadMore();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('25. loadMore does nothing when hasMore is false', async () => {
    component.hasMore.set(false);
    supabaseSpy.client.from.calls.reset();
    await component.loadMore();
    expect(supabaseSpy.client.from).not.toHaveBeenCalled();
  });

  it('26. loadMore appends new posts to existing list', async () => {
    const existingPost = makePost({ id: 'old', created_at: new Date(Date.now() - 1000).toISOString() });
    const newPost = makePost({ id: 'newer' });
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: [newPost], error: null }));
    component.hasMore.set(true);
    component.posts.set([existingPost]);
    await component.loadMore();
    expect(component.posts().length).toBe(2);
    expect(component.posts()[0]).toEqual(existingPost);
    expect(component.posts()[1]).toEqual(newPost);
  });

  it('27. loadMore calls toast.error on supabase error', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'fail' } }));
    component.hasMore.set(true);
    component.posts.set([makePost()]);
    await component.loadMore();
    expect(toastSpy.error).toHaveBeenCalled();
  });

  it('28. loadMore resets loadingMore to false in finally', async () => {
    supabaseSpy.client.from.and.returnValue(mockBuilder({ data: [], error: null }));
    component.hasMore.set(true);
    await component.loadMore();
    expect(component.loadingMore()).toBeFalse();
  });

  // -------------------------------------------------------------------------
  // profileRoute()
  // -------------------------------------------------------------------------

  it('29. profileRoute returns null when author_profile_id is null', () => {
    const post = makePost({ author_profile_id: null as any });
    expect(component.profileRoute(post)).toBeNull();
  });

  it('30. profileRoute returns route array for known profile type "musician"', () => {
    const post = makePost({ author_profile_type: 'musician', author_profile_id: 'prof-1' });
    expect(component.profileRoute(post)).toEqual(['/musicians', 'prof-1']);
  });

  it('30b. profileRoute returns route array for known profile type "band"', () => {
    const post = makePost({ author_profile_type: 'band', author_profile_id: 'band-1' });
    expect(component.profileRoute(post)).toEqual(['/bands', 'band-1']);
  });

  it('30c. profileRoute returns null for unknown profile type', () => {
    const post = makePost({ author_profile_type: 'unknown_type', author_profile_id: 'x-1' });
    expect(component.profileRoute(post)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // isRecent()
  // -------------------------------------------------------------------------

  it('31. isRecent returns true for a post created seconds ago', () => {
    const post = makePost({ created_at: new Date().toISOString() });
    expect(component.isRecent(post)).toBeTrue();
  });

  it('32. isRecent returns false for a post older than 24 hours', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const post = makePost({ created_at: old });
    expect(component.isRecent(post)).toBeFalse();
  });

  describe('Se busca sections', () => {
    it('lists every post type and the band vacancies in "Todo"', async () => {
      component.section.set('todo');
      await component.loadPosts();
      expect(fromBuilder.in).not.toHaveBeenCalledWith('type', jasmine.anything());
      expect(vacanciesSpy.listOpen).toHaveBeenCalledWith(jasmine.objectContaining({ limit: 30 }));
    });

    it('"Bandas buscan" lists band posts plus the full vacancies list', async () => {
      component.section.set('bandas');
      await component.loadPosts();
      expect(fromBuilder.in).toHaveBeenCalledWith('type', ['band_seeking_musician']);
      expect(vacanciesSpy.listOpen).toHaveBeenCalledWith(jasmine.objectContaining({ limit: 30 }));
    });

    it('"Músicos buscan" lists musician posts and no vacancies', async () => {
      component.section.set('musicos');
      vacanciesSpy.listOpen.calls.reset();
      await component.loadPosts();
      expect(fromBuilder.in).toHaveBeenCalledWith('type', ['musician_seeking_band']);
      expect(vacanciesSpy.listOpen).not.toHaveBeenCalled();
      expect(component.vacancies()).toEqual([]);
    });

    it('passes the city and instrument filters to the vacancies', async () => {
      component.section.set('bandas');
      component.filterCity.set('Madrid');
      component.filterInstrument.set('Batería');
      await component.loadPosts();
      expect(vacanciesSpy.listOpen).toHaveBeenCalledWith(jasmine.objectContaining({ city: 'Madrid', instrument: 'Batería' }));
    });

    it('a vacancies failure does not break the posts', async () => {
      component.section.set('bandas');
      vacanciesSpy.listOpen.and.rejectWith(new Error('boom'));
      await component.loadPosts();
      expect(component.vacancies()).toEqual([]);
      expect(component.loading()).toBeFalse();
    });

    it('setSection writes the section to the URL (todo clears it)', () => {
      component.setSection('otros');
      expect(routerSpy.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { ver: 'otros' } }));
      component.setSection('todo');
      expect(routerSpy.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { ver: null } }));
    });
  });

  describe('mergeSeBusca', () => {
    const vacancy = (over: Record<string, unknown> = {}) => ({
      id: 'v1', band_id: 'b1', instrument: 'Batería', description: null, genre: null,
      created_at: '2026-07-20T10:00:00Z',
      bands: { id: 'b1', name: 'Los Despistados', city: 'Madrid', genre: 'Rock', avatar_url: null },
      ...over,
    }) as any;

    it('merges posts and vacancies newest first', () => {
      const items = mergeSeBusca(
        [makePost({ id: 'p1', created_at: '2026-07-22T10:00:00Z' }), makePost({ id: 'p2', created_at: '2026-07-18T10:00:00Z' })],
        [vacancy()], false);
      expect(items.map(i => i.id)).toEqual(['p1', 'v1', 'p2']);
    });

    it('shows a band post that repeats one of its vacancies only once, as the vacancy', () => {
      const dup = makePost({ id: 'p1', type: 'band_seeking_musician' as PostType, author_name: 'Los Despistados', instrument: 'batería' });
      const items = mergeSeBusca([dup], [vacancy()], false);
      expect(items.map(i => i.kind)).toEqual(['vacancy']);
    });

    it('keeps a band post for a different instrument', () => {
      const other = makePost({ id: 'p1', type: 'band_seeking_musician' as PostType, author_name: 'Los Despistados', instrument: 'Voz' });
      expect(mergeSeBusca([other], [vacancy()], false).length).toBe(2);
    });

    it('holds back vacancies older than the loaded posts while more posts can load', () => {
      const posts = [makePost({ id: 'p1', created_at: '2026-07-22T10:00:00Z' })];
      const old = vacancy({ id: 'v-old', created_at: '2026-01-01T00:00:00Z' });
      expect(mergeSeBusca(posts, [old], true).map(i => i.id)).toEqual(['p1']);
      expect(mergeSeBusca(posts, [old], false).map(i => i.id)).toEqual(['p1', 'v-old']);
    });
  });
});
