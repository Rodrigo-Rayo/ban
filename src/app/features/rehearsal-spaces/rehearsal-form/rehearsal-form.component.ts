import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';

function optionalUrl(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  try { new URL(control.value); return null; } catch { return { url: true }; }
}

function optionalPositiveNumber(control: AbstractControl): ValidationErrors | null {
  if (!control.value && control.value !== 0) return null;
  const n = Number(control.value);
  return isNaN(n) || n < 0 ? { positiveNumber: true } : null;
}

@Component({
  selector: 'app-rehearsal-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './rehearsal-form.component.html',
})
export class RehearsalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private location = inject(Location);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  isEditing = signal(false);
  profileId = signal<string | null>(null);
  error = signal('');

  readonly cities = CITIES;

  form = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2)]],
    city:          ['Madrid', Validators.required],
    hourly_rate:   ['', optionalPositiveNumber],
    capacity:      ['', optionalPositiveNumber],
    address:       [''],
    description:   ['', Validators.maxLength(800)],
    phone:         ['', Validators.pattern(/^[+\d\s\-().]{0,20}$/)],
    instagram_url: ['', optionalUrl],
    website_url:   ['', optionalUrl],
  });

  async ngOnInit() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) { this.router.navigate(['/auth/login']); return; }

      const { data } = await this.supabase.client
        .from('rehearsal_spaces').select('*').eq('user_id', user.id).maybeSingle();

      if (data) {
        this.isEditing.set(true);
        this.profileId.set(data.id);
        this.form.patchValue({
          name:          data.name ?? '',
          city:          data.city ?? 'Madrid',
          hourly_rate:   data.hourly_rate ?? '',
          capacity:      data.capacity ?? '',
          address:       data.address ?? '',
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
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) { this.saving.set(false); this.router.navigate(['/auth/login']); return; }

    const v = this.form.value;
    const { data, error } = await this.supabase.client.from('rehearsal_spaces').upsert({
      user_id:     user.id,
      name:        v.name,
      city:        v.city,
      hourly_rate: v.hourly_rate ? Number(v.hourly_rate) : null,
      capacity:    v.capacity ? Number(v.capacity) : null,
      address:     v.address || null,
      description: v.description || null,
      phone:       v.phone || null,
      instagram_url: v.instagram_url || null,
      website_url:   v.website_url || null,
    }, { onConflict: 'user_id' }).select('id').single();

    this.saving.set(false);
    if (error || !data) {
      this.error.set('No se pudo guardar el local. Inténtalo de nuevo.');
      return;
    }
    this.toast.success(this.isEditing() ? 'Local actualizado.' : 'Local publicado. ¡Ya aparece en el directorio!');
    this.router.navigate(['/rehearsal', data.id]);
  }
}
