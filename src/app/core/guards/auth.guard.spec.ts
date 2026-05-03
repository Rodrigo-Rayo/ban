import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';

describe('authGuard', () => {
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const fakeRoute = {} as ActivatedRouteSnapshot;
  const fakeState = {} as RouterStateSnapshot;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getSession']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('returns true when a session exists', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: fakeSession }, error: null } as never)
    );

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('returns false and navigates to /auth/login when session is null', async () => {
    supabaseSpy.getSession.and.returnValue(
      Promise.resolve({ data: { session: null }, error: null } as never)
    );

    const result = await TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
