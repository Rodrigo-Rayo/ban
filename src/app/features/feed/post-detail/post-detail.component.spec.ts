import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PostDetailComponent, askLabelFor, stampFor } from './post-detail.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesService } from '../../../core/services/messages.service';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';
import { Post, PostType } from '../../../core/models';

function mockBuilder(resolveValue: { data?: any; error?: any }) {
  const b: any = {
    then(resolve: any, reject: any) { return Promise.resolve(resolveValue).then(resolve, reject); },
  };
  ['select', 'eq', 'neq', 'order', 'limit', 'delete'].forEach(m => {
    b[m] = jasmine.createSpy(m).and.returnValue(b);
  });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(Promise.resolve(resolveValue));
  return b;
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1', user_id: 'u1', type: 'musician_seeking_band' as PostType, text: 'Busco banda',
    city: 'Madrid', instrument: 'Guitarra', genre: 'Rock', author_name: 'Ana',
    author_profile_type: 'musician', author_profile_id: 'p1', created_at: new Date().toISOString(),
    ...overrides,
  } as Post;
}

describe('PostDetailComponent', () => {
  let component: PostDetailComponent;
  let supabaseSpy: any;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    supabaseSpy = {
      auth: { getUser: jasmine.createSpy().and.resolveTo({ data: { user: null } }) },
      client: { from: jasmine.createSpy('from').and.returnValue(mockBuilder({ data: [], error: null })) },
    };
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthService, useValue: { isLoggedIn: () => false } },
        { provide: MessagesService, useValue: {} },
        { provide: ToastService, useValue: toastSpy },
        { provide: SeoService, useValue: jasmine.createSpyObj('SeoService', ['set', 'setNotFound']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'post-1' }) } },
      ],
    })
    .overrideComponent(PostDetailComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(PostDetailComponent).componentInstance;
  });

  describe('wording and stamps', () => {
    it('askLabelFor names what the post looks for', () => {
      expect(askLabelFor({ type: 'musician_seeking_band', instrument: 'Guitarra' })).toBe('Busca banda');
      expect(askLabelFor({ type: 'band_seeking_musician', instrument: 'Bajo' })).toBe('Busca bajo');
      expect(askLabelFor({ type: 'band_seeking_musician', instrument: null })).toBe('Busca músico');
      expect(askLabelFor({ type: 'session_offer', instrument: null })).toBe('Ofrece sesiones');
    });

    it('stampFor maps the type to its colour', () => {
      expect(stampFor('musician_seeking_band')).toBe('tag-accent');
      expect(stampFor('band_seeking_musician')).toBe('tag-red');
      expect(stampFor('session_offer')).toBe('tag-green');
      expect(stampFor('other')).toBe('tag');
    });
  });

  describe('loadRelated', () => {
    it('excludes the current post and fills from the same city', async () => {
      const current = makePost({ id: 'post-1' });
      const sameType = [makePost({ id: 'post-1' }), makePost({ id: 'a' })];
      const sameCity = [makePost({ id: 'a' }), makePost({ id: 'b' }), makePost({ id: 'post-1' })];
      supabaseSpy.client.from.and.returnValues(
        mockBuilder({ data: sameType, error: null }),
        mockBuilder({ data: sameCity, error: null }),
      );
      await component.loadRelated(current);
      expect(component.related().map(p => p.id)).toEqual(['a', 'b']);
    });

    it('hides the section when the query fails', async () => {
      component.related.set([makePost({ id: 'x' })]);
      supabaseSpy.client.from.and.returnValue(mockBuilder({ data: null, error: { message: 'boom' } }));
      await component.loadRelated(makePost());
      expect(component.related()).toEqual([]);
    });

    it('hides the section when the query throws', async () => {
      supabaseSpy.client.from.and.throwError('network');
      await component.loadRelated(makePost());
      expect(component.related()).toEqual([]);
    });
  });

  describe('sharePost', () => {
    afterEach(() => { delete (navigator as any).share; });

    it('falls back to the clipboard and toasts when Web Share is unavailable', async () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      const writeText = jasmine.createSpy('writeText').and.resolveTo();
      spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as any);
      component.post.set(makePost());
      await component.sharePost();
      expect(writeText).toHaveBeenCalled();
      expect(toastSpy.success).toHaveBeenCalledWith('Enlace copiado.');
      expect(component.linkCopied()).toBeTrue();
    });

    it('uses the Web Share API when present', async () => {
      const share = jasmine.createSpy('share').and.resolveTo();
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      component.post.set(makePost());
      await component.sharePost();
      expect(share).toHaveBeenCalled();
      expect(toastSpy.success).not.toHaveBeenCalled();
    });
  });
});
