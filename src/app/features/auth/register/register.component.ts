import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { RegistrationStateService } from '../../../core/services/registration-state.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private seo = inject(SeoService);
  private meta = inject(Meta);
  private registrationState = inject(RegistrationStateService);
  auth = inject(AuthService);

  error = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── Password strength ─────────────────────────────────────────────
  get pwStrength(): number {
    const pw: string = this.form.get('password')?.value ?? '';
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 6) s++;
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
    if (this.form.invalid) return;
    const { email, password } = this.form.value;
    this.registrationState.set(email!, password!);
    this.router.navigate(['/onboarding']);
  }

  async loginWithGoogle() {
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (e: any) {
      this.error.set(e.message ?? 'Error con Google');
    }
  }
}
