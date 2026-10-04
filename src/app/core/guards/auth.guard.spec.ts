import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';

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

/** `from()` spy: the profiles row, plus the musician row (or none) for profile tables. */
function tables(profileData: any = { id: 'p-1', role: 'musician' }, ownRow: any = { id: 'm-1' }) {
  return jasmine.createSpy('from').and.callFake((t: string) => makeClientMock(t === 'profiles' ? profileData : t === 'musicians' ? ownRow : null));
}

describe('authGuard', () => {
  let supabaseSpy: jasmine.SpyObj<SupabaseService> & { client: any };
  let routerSpy: jasmine.SpyObj<Router>;
  let fakeUrlTree: UrlTree;
  let verified: string | null;
  const authStub = {
    isRoleVerified: (id: string) => verified === id,
    markRoleVerified: (id: string) => { verified = id; },
  };

  const fakeRoute = {} as ActivatedRouteSnapshot;
  const fakeState = { url: '/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    verified = null;
    fakeUrlTree = new UrlTree();

    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getSession']) as any;
    supabaseSpy.client = { from: tables() };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate', 'createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authStub },
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
      from: tables({ id: 'p-1', role: null }),
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

  it('skips the profile query once the role was verified for the same user', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );

    await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));
    const firstRound = supabaseSpy.client.from.calls.count();
    await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(supabaseSpy.client.from.calls.count()).toBe(firstRound);
  });

  it('does not reuse a verification made for a different user', async () => {
    verified = 'other-user';
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );

    await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(supabaseSpy.client.from).toHaveBeenCalledWith('profiles');
  });

  it('redirects to /onboarding when the role exists but its profile row was deleted', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );
    supabaseSpy.client = { from: tables({ id: 'p-1', role: 'musician' }, null) };

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/onboarding']);
  });

  it('lets a listener ("soy público") through without a profile-type row', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null } as never)
    );
    supabaseSpy.client = { from: tables({ id: 'p-1', role: 'listener' }, null) };

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeTrue();
    expect(supabaseSpy.client.from).toHaveBeenCalledTimes(1);
  });
});
