import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  success = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['musician', Validators.required],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password, role } = this.form.value;
      localStorage.setItem('bandyou_role', role || 'musician');
      localStorage.setItem('bandyou_needs_onboarding', 'true');
      await this.auth.signUpWithEmail(email!, password!);
      this.success.set(true);
    } catch (e: any) {
      const msg: string = e.message ?? '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        this.error.set('Este email ya tiene una cuenta. Prueba a iniciar sesión.');
      } else {
        this.error.set(msg || 'Error al registrarse');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle() {
    this.error.set('');
    try {
      // Store role so onboarding can use it if this is a new Google user.
      // Do NOT set bandyou_needs_onboarding — auth.service checks profile existence for OAuth users.
      localStorage.setItem('bandyou_role', this.form.value.role || 'musician');
      await this.auth.signInWithGoogle();
    } catch (e: any) {
      this.error.set(e.message ?? 'Error con Google');
    }
  }
}
