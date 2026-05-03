import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const nullSessionResponse = { data: { session: null }, error: null };
  const authChangesStub = { data: { subscription: { unsubscribe: () => {} } } };

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getSession',
      'signInWithEmail',
      'signUpWithEmail',
      'signInWithGoogle',
      'signOut',
      'authChanges',
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    supabaseSpy.getSession.and.returnValue(Promise.resolve(nullSessionResponse as never));
    supabaseSpy.authChanges.and.returnValue(authChangesStub as never);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with a null session', () => {
    expect(service.session()).toBeNull();
  });

  it('isLoggedIn is false when there is no session', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('user is null when there is no session', () => {
    expect(service.user()).toBeNull();
  });

  describe('signInWithEmail()', () => {
    it('throws the error returned by supabase', async () => {
      const err = new Error('Invalid credentials');
      supabaseSpy.signInWithEmail.and.returnValue(
        Promise.resolve({ data: { user: null, session: null }, error: err } as never)
      );

      await expectAsync(service.signInWithEmail('a@b.com', 'wrong')).toBeRejectedWith(err);
    });

    it('navigates to /home on success', async () => {
      supabaseSpy.signInWithEmail.and.returnValue(
        Promise.resolve({ data: { user: null, session: null }, error: null } as never)
      );

      await service.signInWithEmail('a@b.com', 'correct');

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('does not navigate when an error is returned', async () => {
      const err = new Error('Auth error');
      supabaseSpy.signInWithEmail.and.returnValue(
        Promise.resolve({ data: { user: null, session: null }, error: err } as never)
      );

      await expectAsync(service.signInWithEmail('a@b.com', 'bad')).toBeRejected();
      expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/home']);
    });
  });

  describe('signUpWithEmail()', () => {
    it('throws the error returned by supabase', async () => {
      const err = new Error('Email already in use');
      supabaseSpy.signUpWithEmail.and.returnValue(
        Promise.resolve({ data: { user: null, session: null }, error: err } as never)
      );

      await expectAsync(service.signUpWithEmail('a@b.com', 'pass')).toBeRejectedWith(err);
    });

    it('resolves without navigating on success', async () => {
      supabaseSpy.signUpWithEmail.and.returnValue(
        Promise.resolve({ data: { user: null, session: null }, error: null } as never)
      );

      await expectAsync(service.signUpWithEmail('a@b.com', 'pass')).toBeResolved();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('signInWithGoogle()', () => {
    it('throws the error returned by supabase', async () => {
      const err = new Error('OAuth error');
      supabaseSpy.signInWithGoogle.and.returnValue(
        Promise.resolve({ data: { provider: 'google', url: '' }, error: err } as never)
      );

      await expectAsync(service.signInWithGoogle()).toBeRejectedWith(err);
    });

    it('resolves when supabase returns no error', async () => {
      supabaseSpy.signInWithGoogle.and.returnValue(
        Promise.resolve({ data: { provider: 'google', url: 'https://google.com' }, error: null } as never)
      );

      await expectAsync(service.signInWithGoogle()).toBeResolved();
    });
  });

  describe('signOut()', () => {
    it('navigates to / on success', async () => {
      supabaseSpy.signOut.and.returnValue(Promise.resolve({ error: null } as never));

      await service.signOut();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('still navigates to / even when supabase.signOut throws', async () => {
      supabaseSpy.signOut.and.returnValue(Promise.reject(new Error('Network error')));

      await service.signOut();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
