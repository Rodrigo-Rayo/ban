import { Component, ElementRef, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';
import { GENRES } from '../../../core/constants/music.constants';
import { optionalUrl, optionalPositiveNumber } from '../../../core/utils/form-validators';

@Component({
    selector: 'app-venue-form',
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './venue-form.component.html'
})
export class VenueFormComponent implements OnInit {
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

  selectedGenres = signal<string[]>([]);

  readonly cities = CITIES;
  readonly genres = GENRES;

  form = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2)]],
    city:          ['Madrid', Validators.required],
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

      const { data, error: loadError } = await this.supabase.client
        .from('venues').select('*').eq('user_id', user.id).maybeSingle();
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
          capacity:      data.capacity ?? '',
          address:       data.address ?? '',
          description:   data.description ?? '',
          phone:         data.phone ?? '',
          instagram_url: data.instagram_url ?? '',
          website_url:   data.website_url ?? '',
        });
        if (data.genres) {
          this.selectedGenres.set(data.genres.split(',').map((s: string) => s.trim()).filter(Boolean));
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  toggleGenre(g: string) {
    const cur = this.selectedGenres();
    this.selectedGenres.set(cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g]);
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
    const { data, error } = await this.supabase.client.from('venues').upsert({
      user_id:      user.id,
      name:         v.name,
      city:         v.city,
      genres:       this.selectedGenres().join(', ') || null,
      capacity:     v.capacity ? Number(v.capacity) : null,
      address:      v.address || null,
      description:  v.description || null,
      phone:        v.phone || null,
      instagram_url: v.instagram_url || null,
      website_url:   v.website_url || null,
    }, { onConflict: 'user_id' }).select('id').single();

    if (error || !data) {
      this.error.set('No se pudo guardar la sala. Inténtalo de nuevo.');
      return;
    }
    this.toast.success(this.isEditing() ? 'Sala actualizada.' : 'Sala publicada. ¡Ya aparece en el directorio!');
    this.router.navigate(['/venues', data.id]);
    } catch {
      this.error.set('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
