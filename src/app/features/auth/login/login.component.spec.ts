import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let seoSpy: { set: jasmine.Spy };
  let metaSpy: { updateTag: jasmine.Spy };
  let routeGetSpy: jasmine.Spy;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'signInWithEmail',
      'signInWithGoogle',
    ]);
    seoSpy = { set: jasmine.createSpy('set') };
    metaSpy = { updateTag: jasmine.createSpy('updateTag') };
    routeGetSpy = jasmine.createSpy('get').and.returnValue(null);

    const activatedRouteMock = {
      snapshot: {
        queryParamMap: { get: routeGetSpy },
      },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: SeoService, useValue: seoSpy },
        { provide: Meta, useValue: metaSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(LoginComponent, {
        set: { imports: [ReactiveFormsModule], template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    spyOn(window, 'scrollTo').and.stub();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Form validation ────────────────────────────────────────────────────────

  describe('form validation', () => {
    it('tells a too-short password the minimum length, not "obligatoria"', () => {
      component.form.setValue({ email: 'user@example.com', password: 'abc' });
      expect(component.passwordError()).toBe('La contraseña debe tener al menos 6 caracteres.');
    });

    it('says the password is required when it is empty', () => {
      component.form.setValue({ email: 'user@example.com', password: '' });
      expect(component.passwordError()).toBe('La contraseña es obligatoria.');
    });

    it('shows "Entra para continuar" when a return URL was stored', () => {
      sessionStorage.setItem('bandyou_return_url', '/inbox');
      try {
        component.ngOnInit();
        expect(component.needsLogin()).toBeTrue();
      } finally {
        sessionStorage.removeItem('bandyou_return_url');
      }
    });

    it('does not show "Entra para continuar" without a return URL', () => {
      sessionStorage.removeItem('bandyou_return_url');
      component.ngOnInit();
      expect(component.needsLogin()).toBeFalse();
    });

    it('is invalid when the email field is empty', () => {
      component.form.setValue({ email: '', password: 'password123' });
      expect(component.form.get('email')!.invalid).toBeTrue();
    });

    it('is invalid when the email is malformed', () => {
      component.form.setValue({ email: 'not-an-email', password: 'password123' });
      expect(component.form.get('email')!.invalid).toBeTrue();
    });

    it('is invalid when the password has fewer than 6 characters', () => {
      component.form.setValue({ email: 'user@example.com', password: 'abc' });
      expect(component.form.get('password')!.invalid).toBeTrue();
    });

    it('is valid when both email and password meet the requirements', () => {
      component.form.setValue({ email: 'user@example.com', password: 'password123' });
      expect(component.form.valid).toBeTrue();
    });
  });

  // ── onSubmit() ─────────────────────────────────────────────────────────────

  describe('onSubmit()', () => {
    it('does not call signInWithEmail when the form is invalid', async () => {
      component.form.setValue({ email: '', password: '' });
      await component.onSubmit();
      expect(authSpy.signInWithEmail).not.toHaveBeenCalled();
    });

    it('marks all fields touched so errors are exposed when the form is invalid', async () => {
      component.form.setValue({ email: '', password: '' });
      await component.onSubmit();
      expect(component.isInvalid('email')).toBeTrue();
      expect(component.isInvalid('password')).toBeTrue();
    });

    it('does not report untouched fields as invalid', () => {
      expect(component.isInvalid('email')).toBeFalse();
    });

    it('sets loading to true while the request is in-flight', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'password123' });
      let loadingDuringCall = false;
      authSpy.signInWithEmail.and.callFake(async () => {
        loadingDuringCall = component.loading();
      });
      await component.onSubmit();
      expect(loadingDuringCall).toBeTrue();
    });

    it('resets loading to false after a successful submission', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'password123' });
      authSpy.signInWithEmail.and.returnValue(Promise.resolve());
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('calls auth.signInWithEmail with the correct credentials', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'mypassword' });
      authSpy.signInWithEmail.and.returnValue(Promise.resolve());
      await component.onSubmit();
      expect(authSpy.signInWithEmail).toHaveBeenCalledWith('user@example.com', 'mypassword');
    });

    it('clears the error signal before attempting the request', async () => {
      component.error.set('previous error');
      component.form.setValue({ email: 'user@example.com', password: 'password123' });
      let errorDuringCall = 'not checked';
      authSpy.signInWithEmail.and.callFake(async () => {
        errorDuringCall = component.error();
      });
      await component.onSubmit();
      expect(errorDuringCall).toBe('');
    });

    it('sets the error signal when signInWithEmail throws', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'wrongpassword' });
      authSpy.signInWithEmail.and.callFake(async () => {
        throw new Error('bad credentials');
      });
      await component.onSubmit();
      expect(component.error()).toBe('Credenciales incorrectas. Verifica tu email y contraseña.');
    });

    it('resets loading to false even when an error is thrown (finally block)', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'wrongpassword' });
      authSpy.signInWithEmail.and.callFake(async () => {
        throw new Error('fail');
      });
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('clears the error on a retry after a previous failure', async () => {
      component.form.setValue({ email: 'user@example.com', password: 'wrongpassword' });
      authSpy.signInWithEmail.and.callFake(async () => {
        throw new Error('fail');
      });
      await component.onSubmit();
      expect(component.error()).toBeTruthy();

      authSpy.signInWithEmail.and.returnValue(Promise.resolve());
      await component.onSubmit();
      expect(component.error()).toBe('');
    });
  });

  // ── loginWithGoogle() ──────────────────────────────────────────────────────

  describe('loginWithGoogle()', () => {
    it('calls auth.signInWithGoogle', async () => {
      authSpy.signInWithGoogle.and.returnValue(Promise.resolve());
      await component.loginWithGoogle();
      expect(authSpy.signInWithGoogle).toHaveBeenCalled();
    });

    it('clears the error signal before calling signInWithGoogle', async () => {
      component.error.set('stale error');
      authSpy.signInWithGoogle.and.returnValue(Promise.resolve());
      await component.loginWithGoogle();
      expect(component.error()).toBe('');
    });

    it('sets the error to the Error message when signInWithGoogle throws an Error', async () => {
      authSpy.signInWithGoogle.and.callFake(async () => {
        throw new Error('OAuth provider error');
      });
      await component.loginWithGoogle();
      expect(component.error()).toBe('OAuth provider error');
    });

    it('sets a generic error when signInWithGoogle throws a non-Error value', async () => {
      authSpy.signInWithGoogle.and.callFake(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'plain string error';
      });
      await component.loginWithGoogle();
      expect(component.error()).toBe('Error con Google');
    });
  });

  // ── Password visibility toggle ─────────────────────────────────────────────

  describe('showPassword', () => {
    it('starts hidden and toggles', () => {
      expect(component.showPassword()).toBeFalse();
      component.showPassword.set(!component.showPassword());
      expect(component.showPassword()).toBeTrue();
    });
  });

  // ── ngOnInit() – OAuth error query param mapping ───────────────────────────

  describe('ngOnInit()', () => {
    it('does not set an error when no oauth error query param is present', () => {
      routeGetSpy.and.returnValue(null);
      component.ngOnInit();
      expect(component.error()).toBe('');
    });

    it('maps access_denied to the correct Spanish message', () => {
      routeGetSpy.and.returnValue('access_denied');
      component.ngOnInit();
      expect(component.error()).toBe('Acceso denegado. Inténtalo de nuevo.');
    });

    it('maps server_error to the correct Spanish message', () => {
      routeGetSpy.and.returnValue('server_error');
      component.ngOnInit();
      expect(component.error()).toBe('Error del servidor. Inténtalo más tarde.');
    });

    it('maps temporarily_unavailable to the correct Spanish message', () => {
      routeGetSpy.and.returnValue('temporarily_unavailable');
      component.ngOnInit();
      expect(component.error()).toBe('Servicio temporalmente no disponible.');
    });

    it('falls back to a generic message for unknown oauth error codes', () => {
      routeGetSpy.and.returnValue('some_unknown_code');
      component.ngOnInit();
      expect(component.error()).toBe('Error de autenticación. Inténtalo de nuevo.');
    });

    it('calls seo.set with the login page title', () => {
      component.ngOnInit();
      expect(seoSpy.set).toHaveBeenCalledWith({ title: 'Iniciar sesión' });
    });

    it('calls meta.updateTag to set noindex/nofollow', () => {
      component.ngOnInit();
      expect(metaSpy.updateTag).toHaveBeenCalledWith({
        name: 'robots',
        content: 'noindex,nofollow',
      });
    });
  });
});
