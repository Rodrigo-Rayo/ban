import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  success = signal(false);
  sessionReady = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', [Validators.required]],
  });

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      this.error.set('El enlace ha expirado o no es válido. Solicita uno nuevo.');
      return;
    }
    this.sessionReady.set(true);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, confirm } = this.form.value;
    if (password !== confirm) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { error } = await this.supabase.auth.updateUser({ password: password! });
    this.loading.set(false);
    if (error) {
      this.error.set('No se pudo actualizar la contraseña. Inténtalo de nuevo.');
    } else {
      this.success.set(true);
      setTimeout(() => this.router.navigate(['/dashboard']), 2500);
    }
  }
}
