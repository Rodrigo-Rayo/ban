import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  private meta = inject(Meta);
  auth = inject(AuthService);

  loading = signal(false);
  error = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit() {
    this.seo.set({ title: 'Iniciar sesión' });
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    // Display OAuth errors forwarded by the callback component (e.g. access_denied)
    const oauthError = this.route.snapshot.queryParamMap.get('error');
    if (oauthError) {
      const KNOWN: Record<string, string> = {
        'access_denied':           'Acceso denegado. Inténtalo de nuevo.',
        'server_error':            'Error del servidor. Inténtalo más tarde.',
        'temporarily_unavailable': 'Servicio temporalmente no disponible.',
        'otp_expired':             'El enlace ha caducado. Solicita uno nuevo.',
      };
      this.error.set(KNOWN[oauthError] ?? 'Error de autenticación. Inténtalo de nuevo.');
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.value;
      await this.auth.signInWithEmail(email!, password!);
    } catch (e: unknown) {
      this.error.set(loginErrorMessage(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle() {
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error con Google');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

/** Maps Supabase auth errors to actionable Spanish messages. */
function loginErrorMessage(e: unknown): string {
  const err = e as { code?: string; status?: number; name?: string } | null;
  switch (err?.code) {
    case 'email_not_confirmed':
      return 'Aún no has confirmado tu email. Revisa tu bandeja de entrada (y spam).';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (err?.name === 'AuthRetryableFetchError' || err?.status === 0) {
    return 'Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.';
  }
  return 'Credenciales incorrectas. Verifica tu email y contraseña.';
}
