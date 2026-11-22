import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthPosterComponent } from '../auth-poster.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { TurnstileComponent } from '../../../shared/components/turnstile/turnstile.component';
import { CAPTCHA_FAILED_MESSAGE, injectCaptchaGate, isCaptchaError } from '../../../shared/components/turnstile/turnstile';

@Component({
    selector: 'app-forgot-password',
    imports: [ReactiveFormsModule, RouterLink, AuthPosterComponent, TurnstileComponent],
    templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Cloudflare Turnstile; inert while no site key is configured. */
  readonly captcha = injectCaptchaGate();
  private turnstile = viewChild(TurnstileComponent);

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
    const { error } = await this.supabase.resetPasswordForEmail(this.form.value.email!, this.captcha.take());
    this.loading.set(false);
    if (error) {
      this.error.set(isCaptchaError(error) ? CAPTCHA_FAILED_MESSAGE : 'No pudimos enviar el correo. Verifica la dirección.');
      this.turnstile()?.reset();
      return;
    }
    this.sent.set(true);
    // Move focus to the confirmation heading so SR/keyboard users land on the new content.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#fp-sent-heading')?.focus());
  }
}
