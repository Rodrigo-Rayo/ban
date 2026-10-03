import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthPosterComponent } from '../auth-poster.component';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
    selector: 'app-forgot-password',
    imports: [ReactiveFormsModule, RouterLink, AuthPosterComponent],
    templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  loading = signal(false);
  sent = signal(false);
  error = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isInvalid(name: 'email'): boolean {
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
    this.loading.set(true);
    this.error.set('');
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      this.form.value.email!,
      { redirectTo: `${window.location.origin}/auth/callback` }
    );
    this.loading.set(false);
    if (error) { this.error.set('No pudimos enviar el correo. Verifica la dirección.'); return; }
    this.sent.set(true);
    // Move focus to the confirmation heading so SR/keyboard users land on the new content.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#fp-sent-heading')?.focus());
  }
}
