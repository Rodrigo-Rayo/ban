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
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.value;
      const { needsConfirmation } = await this.auth.signUpWithEmail(email!, password!);
      if (needsConfirmation) this.success.set(true);
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
      await this.auth.signInWithGoogle();
    } catch (e: any) {
      this.error.set(e.message ?? 'Error con Google');
    }
  }
}
