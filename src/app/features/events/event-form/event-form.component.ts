import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { optionalUrl } from '../../../core/utils/form-validators';
import { CITIES } from '../../../core/constants/cities';
import { GENRES } from '../../../core/constants/music.constants';
import { localToday } from '../../../core/utils/date';

export function futureDate(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return control.value < localToday() ? { pastDate: true } : null;
}

@Component({
    selector: 'app-event-form',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './event-form.component.html'
})
export class EventFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

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
        })
        .select('id')
        .single();

      if (error) {
        this.error.set('Error al crear el evento. Inténtalo de nuevo.');
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
