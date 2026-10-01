import { Component, ElementRef, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';
import { INSTRUMENTS } from '../../../core/constants/music.constants';
import { optionalUrl, optionalPositiveNumber } from '../../../core/utils/form-validators';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './teacher-form.component.html',
})
export class TeacherFormComponent implements OnInit {
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

  selectedInstruments = signal<string[]>([]);
  selectedLevel = signal('');

  readonly instruments = INSTRUMENTS;
  readonly levels = [
    { id: 'principiante', label: 'Principiante' },
    { id: 'aficionado', label: 'Aficionado' },
    { id: 'semi-pro', label: 'Semi-pro' },
    { id: 'pro', label: 'Profesional' },
    { id: 'experto', label: 'Experto' },
  ];
  readonly modalities = [
    { id: 'presencial', label: 'Presencial' },
    { id: 'online', label: 'Online' },
    { id: 'ambas', label: 'Presencial y online' },
  ];
  readonly cities = CITIES;

  form = this.fb.group({
    name:             ['', [Validators.required, Validators.minLength(2)]],
    city:             ['Madrid', Validators.required],
    hourly_rate:      ['', optionalPositiveNumber],
    modality:         ['presencial'],
    experience_years: ['', optionalPositiveNumber],
    experience:       [''],
    description:      ['', Validators.maxLength(800)],
    instagram_url:    ['', optionalUrl],
    youtube_url:      ['', optionalUrl],
    website_url:      ['', optionalUrl],
  });

  async ngOnInit() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) { this.router.navigate(['/auth/login']); return; }

      const { data, error: loadError } = await this.supabase.client
        .from('teachers').select('*').eq('user_id', user.id).maybeSingle();
      if (loadError) {
        this.loadFailed.set(true);
        this.error.set('No se pudo cargar tu perfil. Recarga la página antes de guardar.');
        return;
      }

      if (data) {
        this.isEditing.set(true);
        this.profileId.set(data.id);
        this.form.patchValue({
          name:             data.name ?? '',
          city:             data.city ?? 'Madrid',
          hourly_rate:      data.hourly_rate ?? '',
          modality:         data.modality ?? 'presencial',
          experience_years: data.experience_years ?? '',
          experience:       data.experience ?? '',
          description:      data.description ?? '',
          instagram_url:    data.instagram_url ?? '',
          youtube_url:      data.youtube_url ?? '',
          website_url:      data.website_url ?? '',
        });
        if (data.instrument) {
          this.selectedInstruments.set(data.instrument.split(',').map((s: string) => s.trim()).filter(Boolean));
        }
        if (data.level) this.selectedLevel.set(data.level);
      }
    } finally {
      this.loading.set(false);
    }
  }

  toggleInstrument(i: string) {
    const cur = this.selectedInstruments();
    this.selectedInstruments.set(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
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
    const { data, error } = await this.supabase.client.from('teachers').upsert({
      user_id:          user.id,
      name:             v.name,
      city:             v.city,
      instrument:       this.selectedInstruments().join(', ') || null,
      level:            this.selectedLevel() || null,
      hourly_rate:      v.hourly_rate ? Number(v.hourly_rate) : null,
      modality:         v.modality,
      experience_years: v.experience_years ? Number(v.experience_years) : null,
      experience:       v.experience || null,
      description:      v.description || null,
      instagram_url:    v.instagram_url || null,
      youtube_url:      v.youtube_url || null,
      website_url:      v.website_url || null,
    }, { onConflict: 'user_id' }).select('id').single();

    if (error || !data) {
      this.error.set('No se pudo guardar el perfil. Inténtalo de nuevo.');
      return;
    }
    this.toast.success(this.isEditing() ? 'Perfil de profesor actualizado.' : 'Perfil publicado. ¡Ya apareces en el directorio!');
    this.router.navigate(['/teachers', data.id]);
    } catch {
      this.error.set('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
