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
    if (oauthError) this.error.set(oauthError);
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.value;
      await this.auth.signInWithEmail(email!, password!);
    } catch (e: any) {
      this.error.set('Credenciales incorrectas. Verifica tu email y contraseña.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
