import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { RegistrationStateService } from '../../../core/services/registration-state.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let seoSpy: { set: jasmine.Spy };
  let metaSpy: { updateTag: jasmine.Spy };
  let registrationStateSpy: { set: jasmine.Spy };

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['signInWithGoogle']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    seoSpy = { set: jasmine.createSpy('set') };
    metaSpy = { updateTag: jasmine.createSpy('updateTag') };
    registrationStateSpy = { set: jasmine.createSpy('set') };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SeoService, useValue: seoSpy },
        { provide: Meta, useValue: metaSpy },
        { provide: RegistrationStateService, useValue: registrationStateSpy },
      ],
    })
      .overrideComponent(RegisterComponent, {
        set: { imports: [ReactiveFormsModule], template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── onSubmit() ─────────────────────────────────────────────────────────────

  describe('onSubmit()', () => {
    it('does nothing when the form is invalid', () => {
      component.form.setValue({ email: '', password: '' });
      component.onSubmit();
      expect(registrationStateSpy.set).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('calls registrationState.set with the correct email and password', () => {
      component.form.setValue({ email: 'user@example.com', password: 'securepass' });
      component.onSubmit();
      expect(registrationStateSpy.set).toHaveBeenCalledWith('user@example.com', 'securepass');
    });

    it('navigates to /onboarding on a valid submission', () => {
      component.form.setValue({ email: 'user@example.com', password: 'securepass' });
      component.onSubmit();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/onboarding']);
    });

    it('does not navigate when email is malformed', () => {
      component.form.setValue({ email: 'not-email', password: 'securepass' });
      component.onSubmit();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('does not navigate when password is too short', () => {
      component.form.setValue({ email: 'user@example.com', password: 'abc' });
      component.onSubmit();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  // ── legal notice (no checkbox: signing up accepts the Terms) ─────────────

  describe('legal notice', () => {
    it('exposes the LOPDGDD minimum age of 14 for the notice', () => {
      expect(component.minAge).toBe(14);
    });

    it('lets Google sign-up start without any extra step', async () => {
      authSpy.signInWithGoogle.and.returnValue(Promise.resolve());
      await component.loginWithGoogle();
      expect(authSpy.signInWithGoogle).toHaveBeenCalled();
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
      component.error.set('old error');
      authSpy.signInWithGoogle.and.returnValue(Promise.resolve());
      await component.loginWithGoogle();
      expect(component.error()).toBe('');
    });

    it('sets the error to the Error message when signInWithGoogle throws an Error', async () => {
      authSpy.signInWithGoogle.and.callFake(async () => {
        throw new Error('Provider unavailable');
      });
      await component.loginWithGoogle();
      expect(component.error()).toBe('Provider unavailable');
    });

    it('sets a generic error when signInWithGoogle throws a non-Error value', async () => {
      authSpy.signInWithGoogle.and.callFake(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'non-error rejection';
      });
      await component.loginWithGoogle();
      expect(component.error()).toBe('Error con Google');
    });
  });

  // ── pwStrength getter ──────────────────────────────────────────────────────

  describe('pwStrength', () => {
    function setPassword(pw: string) {
      component.form.get('password')!.setValue(pw);
    }

    it('returns 0 for an empty password', () => {
      setPassword('');
      expect(component.pwStrength).toBe(0);
    });

    it('returns 1 for a 8-character all-lowercase password', () => {
      setPassword('abcdefgh');
      // only length >= 8 passes
      expect(component.pwStrength).toBe(1);
    });

    it('returns 2 for a password that is 10+ characters but only lowercase', () => {
      setPassword('abcdefghij');
      // length >= 8 (1) + length >= 10 (1) = 2
      expect(component.pwStrength).toBe(2);
    });

    it('returns 3 for a password with length >= 8, uppercase, and digit', () => {
      setPassword('Abcdefg1');
      // length >= 8 (1) + uppercase (1) + digit (1) = 3
      expect(component.pwStrength).toBe(3);
    });

    it('returns 5 when all criteria are satisfied', () => {
      setPassword('Abcdefgh1!');
      // length >= 8 (1) + length >= 10 (1) + uppercase (1) + digit (1) + special (1) = 5
      expect(component.pwStrength).toBe(5);
    });

    it('counts the digit criterion independently', () => {
      setPassword('abcdefg1');
      // length >= 8 (1) + digit (1) = 2
      expect(component.pwStrength).toBe(2);
    });

    it('counts the special character criterion independently', () => {
      setPassword('abcdefg!');
      // length >= 8 (1) + special (1) = 2
      expect(component.pwStrength).toBe(2);
    });
  });

  // ── pwStrengthLabel getter ─────────────────────────────────────────────────

  describe('pwStrengthLabel', () => {
    function setPassword(pw: string) {
      component.form.get('password')!.setValue(pw);
    }

    it('returns empty string when password is empty (strength 0)', () => {
      setPassword('');
      expect(component.pwStrengthLabel).toBe('');
    });

    it('returns Débil for strength 1 (8-char lowercase)', () => {
      setPassword('abcdefgh');
      expect(component.pwStrengthLabel).toBe('Débil');
    });

    it('returns Débil for strength 2 (10-char lowercase)', () => {
      setPassword('abcdefghij');
      expect(component.pwStrengthLabel).toBe('Débil');
    });

    it('returns Media for strength 3', () => {
      setPassword('Abcdefg1');
      expect(component.pwStrengthLabel).toBe('Media');
    });

    it('returns Media for strength 4', () => {
      setPassword('Abcdefgh1');
      // length >= 8 (1) + length >= 10 ... wait, 9 chars; try: Abcde1gh!
      // Abcde1gh! → length>=8(1), no >=10, uppercase(1), digit(1), special(1) = 4
      setPassword('Abcde1gh!');
      expect(component.pwStrengthLabel).toBe('Media');
    });

    it('returns Fuerte for strength 5', () => {
      setPassword('Abcdefgh1!');
      expect(component.pwStrengthLabel).toBe('Fuerte');
    });
  });

  // ── pwStrengthSegments getter ──────────────────────────────────────────────

  describe('pwStrengthSegments', () => {
    function setPassword(pw: string) {
      component.form.get('password')!.setValue(pw);
    }

    it('returns 1 for strength <= 2 (weak)', () => {
      setPassword('abcdefgh'); // strength = 1
      expect(component.pwStrengthSegments).toBe(1);
    });

    it('returns 1 for strength exactly 2', () => {
      setPassword('abcdefghij'); // strength = 2
      expect(component.pwStrengthSegments).toBe(1);
    });

    it('returns 2 for strength 3', () => {
      setPassword('Abcdefg1'); // strength = 3
      expect(component.pwStrengthSegments).toBe(2);
    });

    it('returns 2 for strength 4', () => {
      setPassword('Abcde1gh!'); // strength = 4
      expect(component.pwStrengthSegments).toBe(2);
    });

    it('returns 3 for strength 5', () => {
      setPassword('Abcdefgh1!'); // strength = 5
      expect(component.pwStrengthSegments).toBe(3);
    });
  });
});
