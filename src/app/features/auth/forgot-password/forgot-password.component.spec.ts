import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ForgotPasswordComponent } from './forgot-password.component';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let resetPasswordSpy: jasmine.Spy;

  beforeEach(async () => {
    resetPasswordSpy = jasmine.createSpy('resetPasswordForEmail');

    const supabaseMock = {
      auth: {
        resetPasswordForEmail: resetPasswordSpy,
      },
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    })
      .overrideComponent(ForgotPasswordComponent, {
        set: { imports: [ReactiveFormsModule], template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Initial signal state ───────────────────────────────────────────────────

  it('starts with loading false', () => {
    expect(component.loading()).toBeFalse();
  });

  it('starts with sent false', () => {
    expect(component.sent()).toBeFalse();
  });

  it('starts with an empty error', () => {
    expect(component.error()).toBe('');
  });

  // ── onSubmit() – invalid form ──────────────────────────────────────────────

  describe('onSubmit() with an invalid form', () => {
    it('does not call resetPasswordForEmail when the form is invalid', async () => {
      component.form.setValue({ email: '' });
      await component.onSubmit();
      expect(resetPasswordSpy).not.toHaveBeenCalled();
    });

    it('calls markAllAsTouched when the form is invalid', async () => {
      component.form.setValue({ email: '' });
      spyOn(component.form, 'markAllAsTouched');
      await component.onSubmit();
      expect(component.form.markAllAsTouched).toHaveBeenCalled();
    });

    it('does not call resetPasswordForEmail for a malformed email', async () => {
      component.form.setValue({ email: 'not-an-email' });
      await component.onSubmit();
      expect(resetPasswordSpy).not.toHaveBeenCalled();
    });
  });

  // ── onSubmit() – success path ──────────────────────────────────────────────

  describe('onSubmit() on success', () => {
    beforeEach(() => {
      component.form.setValue({ email: 'user@example.com' });
      resetPasswordSpy.and.returnValue(Promise.resolve({ error: null }));
    });

    it('sets loading to true while the request is in-flight', async () => {
      let loadingDuringCall = false;
      resetPasswordSpy.and.callFake(async () => {
        loadingDuringCall = component.loading();
        return { error: null };
      });
      await component.onSubmit();
      expect(loadingDuringCall).toBeTrue();
    });

    it('resets loading to false after the request completes', async () => {
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('sets sent to true on a successful response', async () => {
      await component.onSubmit();
      expect(component.sent()).toBeTrue();
    });

    it('does not set an error on success', async () => {
      await component.onSubmit();
      expect(component.error()).toBe('');
    });

    it('clears a previous error before making the request', async () => {
      component.error.set('previous error');
      let errorDuringCall = 'not checked';
      resetPasswordSpy.and.callFake(async () => {
        errorDuringCall = component.error();
        return { error: null };
      });
      await component.onSubmit();
      expect(errorDuringCall).toBe('');
    });
  });

  // ── onSubmit() – error path ────────────────────────────────────────────────

  describe('onSubmit() on supabase error', () => {
    beforeEach(() => {
      component.form.setValue({ email: 'user@example.com' });
      resetPasswordSpy.and.returnValue(
        Promise.resolve({ error: { message: 'email not found' } })
      );
    });

    it('sets the error signal when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.error()).toBe(
        'No pudimos enviar el correo. Verifica la dirección.'
      );
    });

    it('resets loading to false when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.loading()).toBeFalse();
    });

    it('does not set sent to true when supabase returns an error', async () => {
      await component.onSubmit();
      expect(component.sent()).toBeFalse();
    });

    it('clears the error on a retry that succeeds', async () => {
      await component.onSubmit();
      expect(component.error()).toBeTruthy();

      resetPasswordSpy.and.callFake(() => Promise.resolve({ error: null }));
      await component.onSubmit();
      expect(component.error()).toBe('');
    });
  });
});
