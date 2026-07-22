import { Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';

function futureDate(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const today = new Date().toISOString().split('T')[0];
  return control.value < today ? { pastDate: true } : null;
}

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form.component.html',
})
export class EventFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private location = inject(Location);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  loading = signal(false);
  error = signal('');
  private _submitted = false;
  readonly today = new Date().toISOString().split('T')[0];

  goBack() { this.location.back(); }

  genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Otro'];
  cities = CITIES;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    venue: ['', Validators.required],
    city: ['Madrid', Validators.required],
    date: ['', [Validators.required, futureDate]],
    time: [''],
    genre: ['', Validators.required],
    price: [null as number | null],
    description: ['', [Validators.maxLength(500)]],
    contactEmail: ['', [Validators.email]],
    ticketUrl: [''],
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
          genre: v.genre,
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
