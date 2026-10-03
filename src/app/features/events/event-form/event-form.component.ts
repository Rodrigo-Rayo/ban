import { publishErrorMessage } from '../../../core/utils/publish-error';
import { Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { optionalUrl } from '../../../core/utils/form-validators';
import { CITIES } from '../../../core/constants/cities';
import { GENRES } from '../../../core/constants/music.constants';
import { localToday } from '../../../core/utils/date';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { MediaUploadService, MEDIA_ACCEPT, mediaPickError } from '../../../core/services/media-upload.service';

export function futureDate(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return control.value < localToday() ? { pastDate: true } : null;
}

@Component({
    selector: 'app-event-form',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './event-form.component.html'
})
export class EventFormComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private media = inject(MediaUploadService);
  private features = inject(MediaFeaturesService);

  /** Poster upload is offered only once events.image_url exists (see MediaFeaturesService). */
  readonly canAddPoster = this.features.state('eventImage');
  readonly posterAccept = MEDIA_ACCEPT;
  posterFile = signal<File | null>(null);
  posterPreview = signal<string | null>(null);
  posterError = signal('');

  constructor() {
    void this.features.has('eventImage');
  }

  onPosterChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (!file) return;
    const invalid = mediaPickError(file);
    if (invalid) { this.posterError.set(invalid); return; }
    this.posterError.set('');
    this.setPoster(file);
  }

  removePoster() {
    this.posterError.set('');
    this.setPoster(null);
  }

  private setPoster(file: File | null) {
    const old = this.posterPreview();
    if (old) URL.revokeObjectURL(old);
    this.posterFile.set(file);
    this.posterPreview.set(file ? URL.createObjectURL(file) : null);
  }

  ngOnDestroy() {
    const url = this.posterPreview();
    if (url) URL.revokeObjectURL(url);
  }

  /** True when a control should expose its error (touched + invalid). */
  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  loading = signal(false);
  error = signal('');
  private _submitted = false;
  readonly today = localToday();

  genres = GENRES;
  cities = CITIES;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    venue: ['', Validators.required],
    city: ['Madrid', Validators.required],
    date: ['', [Validators.required, futureDate]],
    // events.time is NOT NULL in the database: an empty value made the insert fail with 400.
    time: ['', Validators.required],
    genre: [''],
    price: [null as number | null],
    description: ['', [Validators.maxLength(500)]],
    contactEmail: ['', [Validators.email]],
    ticketUrl: ['', optionalUrl],
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.form.dirty && !this.loading() && !this._submitted) {
      event.preventDefault();
      event.returnValue = '';
    }
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
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) { this.router.navigate(['/auth/login']); return; }

      // Upload the poster first; never name image_url unless the column exists.
      let imageUrl: string | null = null;
      const poster = this.posterFile();
      if (poster && this.canAddPoster()) {
        imageUrl = await this.media.upload(poster, 'events');
        if (!imageUrl) {
          this.error.set('No se pudo subir el cartel. Inténtalo de nuevo o quítalo para publicar sin imagen.');
          return;
        }
      }

      const v = this.form.value;
      const { error, data } = await this.supabase.client
        .from('events')
        .insert({
          user_id: user.id,
          title: v.title,
          venue: v.venue,
          city: v.city,
          date: v.date,
          time: v.time,
          // Optional. Sent as '' (not null) because the live column may be NOT NULL.
          genre: v.genre || '',
          price: v.price != null && v.price > 0 ? String(v.price) : null,
          description: v.description,
          contact_email: v.contactEmail,
          ticket_url: v.ticketUrl,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        })
        .select('id')
        .single();

      if (error) {
        this.error.set(publishErrorMessage(error, 'Error al crear el evento. Inténtalo de nuevo.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.toast.success('Evento publicado correctamente.');
        this._submitted = true;
        this.router.navigate(['/events', data.id]);
      }
    } catch {
      this.error.set('Error inesperado. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
