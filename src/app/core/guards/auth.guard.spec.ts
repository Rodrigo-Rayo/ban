import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';

function makeClientMock(profileData: any = { id: 'p-1', role: 'musician' }) {
  const b: any = {
    then(resolve: any, reject: any) {
      return Promise.resolve({ data: profileData, error: null }).then(resolve, reject);
    },
  };
  ['select', 'eq', 'neq', 'order', 'limit'].forEach(m => { b[m] = jasmine.createSpy(m).and.returnValue(b); });
  b.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
    Promise.resolve({ data: profileData, error: null })
  );
  return b;
}

describe('authGuard', () => {
  let supabaseSpy: jasmine.SpyObj<SupabaseService> & { client: any };
  let routerSpy: jasmine.SpyObj<Router>;
  let fakeUrlTree: UrlTree;

  const fakeRoute = {} as ActivatedRouteSnapshot;
  const fakeState = { url: '/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    fakeUrlTree = new UrlTree();

    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getSession']) as any;
    supabaseSpy.client = { from: jasmine.createSpy('from').and.returnValue(makeClientMock()) };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate', 'createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('returns true when a session and profile with role exist', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /auth/login UrlTree when session is null', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: null }, error: null } as never)
    );

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });

  it('redirects to /onboarding when session exists but profile has no role', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );
    supabaseSpy.client = {
      from: jasmine.createSpy('from').and.returnValue(makeClientMock({ id: 'p-1', role: null })),
    };

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/onboarding']);
  });

  it('returns true when profile query fails (network error)', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );
    const errBuilder: any = {};
    ['select', 'eq'].forEach(m => { errBuilder[m] = jasmine.createSpy(m).and.returnValue(errBuilder); });
    errBuilder.maybeSingle = jasmine.createSpy('maybeSingle').and.returnValue(
      Promise.resolve({ data: null, error: { message: 'network error' } })
    );
    supabaseSpy.client = { from: jasmine.createSpy('from').and.returnValue(errBuilder) };

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeTrue();
  });
});
