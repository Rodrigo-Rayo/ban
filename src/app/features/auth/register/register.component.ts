import { Component, ElementRef, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthPosterComponent } from '../auth-poster.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { RegistrationStateService } from '../../../core/services/registration-state.service';
import { LEGAL_INFO } from '../../legal/legal-info';

@Component({
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterLink, AuthPosterComponent],
    templateUrl: './register.component.html'
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private seo = inject(SeoService);
  private meta = inject(Meta);
  private registrationState = inject(RegistrationStateService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  auth = inject(AuthService);

  error = signal('');
  showPassword = signal(false);

  /** True when a control should expose its error (touched + invalid). */
  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Legal consent + age confirmation; kept outside `form` because it also gates Google sign-up. */
  readonly legalConsent = new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] });
  readonly minAge = LEGAL_INFO.minAge;

  // ── Password strength ─────────────────────────────────────────────
  get pwStrength(): number {
    const pw: string = this.form.get('password')?.value ?? '';
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  get pwStrengthSegments(): number {
    const s = this.pwStrength;
    if (s <= 2) return 1;
    if (s <= 4) return 2;
    return 3;
  }

  get pwStrengthLabel(): string {
    const s = this.pwStrength;
    if (s === 0) return '';
    if (s <= 2) return 'Débil';
    if (s <= 4) return 'Media';
    return 'Fuerte';
  }

  ngOnInit() {
    this.seo.set({ title: 'Crear cuenta' });
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Show the consent error in the same pass, not only after the fields are fixed.
      this.legalConsent.markAsTouched();
      // Scope to the <form>: the legal-consent checkbox lives outside it and has its own gate.
      this.host.nativeElement
        .querySelector<HTMLElement>('form input.ng-invalid, form select.ng-invalid, form textarea.ng-invalid')
        ?.focus();
      return;
    }
    if (!this.ensureLegalConsent()) return;
    const { email, password } = this.form.value;
    this.registrationState.set(email!, password!);
    this.router.navigate(['/onboarding']);
  }

  async loginWithGoogle() {
    this.error.set('');
    if (!this.ensureLegalConsent()) return;
    // Google returns via /auth/callback → onboarding; carry the consent across the redirect.
    try { sessionStorage.setItem('bandyou_consent_pending', LEGAL_INFO.version); } catch { /* storage blocked */ }
    try {
      await this.auth.signInWithGoogle();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error con Google');
    }
  }

  /**
   * Explicit, non-pre-checked acceptance of the Terms + age confirmation
   * (LOPDGDD art. 7). Required before either sign-up method creates an account.
   */
  private ensureLegalConsent(): boolean {
    if (this.legalConsent.valid) return true;
    this.legalConsent.markAsTouched();
    this.host.nativeElement.querySelector<HTMLElement>('#reg-legal')?.focus();
    return false;
  }
}
