import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  loading = signal(false);
  error = signal('');
  success = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      this.form.value.email!,
      { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password` }
    );
    this.loading.set(false);
    if (error) {
      this.error.set(error.message);
    } else {
      this.success.set(true);
    }
  }
}
