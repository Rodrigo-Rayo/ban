import { Component, ElementRef, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
    selector: 'app-reset-password',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  loading = signal(false);
  error = signal('');
  success = signal(false);
  sessionReady = signal(false);
  showPassword = signal(false);
  /** Set when both fields are filled but do not match. */
  mismatch = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
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

  isInvalid(name: 'password' | 'confirm'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid')
        ?.focus();
      return;
    }
    const { password, confirm } = this.form.value;
    if (password !== confirm) {
      this.mismatch.set(true);
      this.error.set('Las contraseñas no coinciden');
      this.host.nativeElement.querySelector<HTMLElement>('#rp-confirm')?.focus();
      return;
    }
    this.mismatch.set(false);
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
