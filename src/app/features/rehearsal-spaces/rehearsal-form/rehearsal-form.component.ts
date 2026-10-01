import { Component, ElementRef, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';
import { optionalUrl, optionalPositiveNumber } from '../../../core/utils/form-validators';

@Component({
    selector: 'app-rehearsal-form',
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './rehearsal-form.component.html'
})
export class RehearsalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private location = inject(Location);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** True when a control should expose its error (touched + invalid). */
  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  loading = signal(true);
  saving = signal(false);
  isEditing = signal(false);
  profileId = signal<string | null>(null);
  error = signal('');
  /** True when the existing profile could not be loaded — saving would overwrite it with blanks. */
  loadFailed = signal(false);

  readonly cities = CITIES;

  form = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2)]],
    city:          ['Madrid', Validators.required],
    hourly_rate:   ['', optionalPositiveNumber],
    capacity:      ['', optionalPositiveNumber],
    address:       [''],
    opening_hours: [''],
    description:   ['', Validators.maxLength(800)],
    phone:         ['', Validators.pattern(/^[+\d\s\-().]{0,20}$/)],
    instagram_url: ['', optionalUrl],
    website_url:   ['', optionalUrl],
  });

  async ngOnInit() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) { this.router.navigate(['/auth/login']); return; }

      const { data, error: loadError } = await this.supabase.client
        .from('rehearsal_spaces').select('*').eq('user_id', user.id).maybeSingle();
      if (loadError) {
        this.loadFailed.set(true);
        this.error.set('No se pudo cargar tu perfil. Recarga la página antes de guardar.');
        return;
      }

      if (data) {
        this.isEditing.set(true);
        this.profileId.set(data.id);
        this.form.patchValue({
          name:          data.name ?? '',
          city:          data.city ?? 'Madrid',
          hourly_rate:   data.hourly_rate ?? '',
          capacity:      data.capacity ?? '',
          address:       data.address ?? '',
          opening_hours: data.opening_hours ?? '',
          description:   data.description ?? '',
          phone:         data.phone ?? '',
          instagram_url: data.instagram_url ?? '',
          website_url:   data.website_url ?? '',
        });
      }
    } finally {
      this.loading.set(false);
    }
  }

  goBack() { this.location.back(); }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid')
        ?.focus();
      return;
    }
    if (this.loadFailed() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }

    const v = this.form.value;
    const { data, error } = await this.supabase.client.from('rehearsal_spaces').upsert({
      user_id:     user.id,
      name:        v.name,
      city:        v.city,
      hourly_rate: v.hourly_rate ? Number(v.hourly_rate) : null,
      capacity:    v.capacity ? Number(v.capacity) : null,
      address:       v.address || null,
      opening_hours: v.opening_hours || null,
      description:   v.description || null,
      phone:       v.phone || null,
      instagram_url: v.instagram_url || null,
      website_url:   v.website_url || null,
    }, { onConflict: 'user_id' }).select('id').single();

    if (error || !data) {
      this.error.set('No se pudo guardar el local. Inténtalo de nuevo.');
      return;
    }
    this.toast.success(this.isEditing() ? 'Local actualizado.' : 'Local publicado. ¡Ya aparece en el directorio!');
    this.router.navigate(['/rehearsal', data.id]);
    } catch {
      this.error.set('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
