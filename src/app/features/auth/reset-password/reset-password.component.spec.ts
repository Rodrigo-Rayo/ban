import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let getSessionSpy: jasmine.Spy;
  let updateUserSpy: jasmine.Spy;

  const SESSION_RESPONSE = {
    data: { session: { user: { id: 'user-123' } } },
  };
  const NO_SESSION_RESPONSE = { data: { session: null } };

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    getSessionSpy = jasmine
      .createSpy('getSession')
      .and.returnValue(Promise.resolve(SESSION_RESPONSE));
    updateUserSpy = jasmine
      .createSpy('updateUser')
      .and.returnValue(Promise.resolve({ error: null }));

    const supabaseMock = {
      auth: {
        getSession: getSessionSpy,
        updateUser: updateUserSpy,
      },
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(ResetPasswordComponent, {
        set: { imports: [ReactiveFormsModule], template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Initial signal state ───────────────────────────────────────────────────

  it('starts with loading false', () => {
    expect(component.loading()).toBeFalse();
  });

  it('starts with success false', () => {
    expect(component.success()).toBeFalse();
  });

  it('starts with sessionReady false', () => {
    expect(component.sessionReady()).toBeFalse();
  });

  it('starts with an empty error', () => {
    expect(component.error()).toBe('');
  });

  // ── ngOnInit() ─────────────────────────────────────────────────────────────

  describe('ngOnInit()', () => {
    it('sets an error when supabase returns no session', async () => {
      getSessionSpy.and.returnValue(Promise.resolve(NO_SESSION_RESPONSE));
      await component.ngOnInit();
      expect(component.error()).toBe(
        'El enlace ha expirado o no es válido. Solicita uno nuevo.'
      );
    });

    it('does not set sessionReady when there is no session', async () => {
      getSessionSpy.and.returnValue(Promise.resolve(NO_SESSION_RESPONSE));
      await component.ngOnInit();
      expect(component.sessionReady()).toBeFalse();
    });

    it('sets sessionReady to true when a valid session exists', async () => {
      await component.ngOnInit();
      expect(component.sessionReady()).toBeTrue();
    });

    it('does not set an error when a valid session exists', async () => {
      await component.ngOnInit();
      expect(component.error()).toBe('');
    });
  });

  // ── onSubmit() – validation ────────────────────────────────────────────────

  describe('onSubmit() – form validation', () => {
    it('does not call updateUser when the form is invalid', async () => {
      component.form.setValue({ password: '', confirm: '' });
      await component.onSubmit();
      expect(updateUserSpy).not.toHaveBeenCalled();
    });

    it('calls markAllAsTouched when the form is invalid', async () => {
      component.form.setValue({ password: '', confirm: '' });
      spyOn(component.form, 'markAllAsTouched');
      await component.onSubmit();
      expect(component.form.markAllAsTouched).toHaveBeenCalled();
    });

    it('does not call updateUser when password is too short', async () => {
      component.form.setValue({ password: 'abc', confirm: 'abc' });
      await component.onSubmit();
      expect(updateUserSpy).not.toHaveBeenCalled();
    });
  });

  // ── onSubmit() – password mismatch ────────────────────────────────────────

  describe('onSubmit() – password mismatch', () => {
    it('sets an error when passwords do not match', async () => {
      component.form.setValue({ password: 'password123', confirm: 'different123' });
      await component.onSubmit();
      expect(component.error()).toBe('Las contraseñas no coinciden');
    });

    it('does not call updateUser when passwords do not match', async () => {
      component.form.setValue({ password: 'password123', confirm: 'different123' });
      await component.onSubmit();
      expect(updateUserSpy).not.toHaveBeenCalled();
    });
  });

  // ── onSubmit() – success path ──────────────────────────────────────────────

  describe('onSubmit() on success', () => {
    beforeEach(() => {
      component.form.setValue({ password: 'newpassword', confirm: 'newpassword' });
      updateUserSpy.and.returnValue(Promise.resolve({ error: null }));
    });

    it('sets loading to true while the request is in-flight', async () => {
      let loadingDuringCall = false;
      updateUserSpy.and.callFake(async () => {
        loadingDuringCall = component.loading();
        return { error: null };
      });
      await component.onSubmit();
      expect(loadingDuringCall).toBeTrue();
    });

    it('resets loading to false after a successful update', async () => {
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('sets success to true after a successful update', async () => {
      await component.onSubmit();
      expect(component.success()).toBeTrue();
    });

    it('clears the error signal before making the request', async () => {
      component.error.set('previous error');
      let errorDuringCall = 'not checked';
      updateUserSpy.and.callFake(async () => {
        errorDuringCall = component.error();
        return { error: null };
      });
      await component.onSubmit();
      expect(errorDuringCall).toBe('');
    });

    it('calls auth.updateUser with the new password', async () => {
      await component.onSubmit();
      expect(updateUserSpy).toHaveBeenCalledWith({ password: 'newpassword' });
    });

    it(
      'schedules navigation to /dashboard after 2500ms',
      fakeAsync(() => {
        component.form.setValue({ password: 'newpassword', confirm: 'newpassword' });
        updateUserSpy.and.returnValue(Promise.resolve({ error: null }));

        component.onSubmit();
        tick(2500);

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
      })
    );

    it(
      'does not navigate before the 2500ms delay elapses',
      fakeAsync(() => {
        component.form.setValue({ password: 'newpassword', confirm: 'newpassword' });
        updateUserSpy.and.returnValue(Promise.resolve({ error: null }));

        component.onSubmit();
        tick(1000);

        expect(routerSpy.navigate).not.toHaveBeenCalled();
        tick(1500); // flush remaining timer
      })
    );
  });

  // ── onSubmit() – error path ────────────────────────────────────────────────

  describe('onSubmit() on supabase error', () => {
    beforeEach(() => {
      component.form.setValue({ password: 'newpassword', confirm: 'newpassword' });
      updateUserSpy.and.returnValue(
        Promise.resolve({ error: { message: 'update failed' } })
      );
    });

    it('sets the error signal when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.error()).toBe(
        'No se pudo actualizar la contraseña. Inténtalo de nuevo.'
      );
    });

    it('resets loading to false when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('does not set success to true when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.success()).toBeFalse();
    });

    it('does not navigate when supabase returns an error', async () => {
      await component.onSubmit();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });
});
