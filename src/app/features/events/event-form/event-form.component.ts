import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { CITIES } from '../../../core/constants/cities';

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
  success = signal(false);
  error = signal('');

  goBack() { this.location.back(); }

  genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Otro'];
  cities = CITIES;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    venue: ['', Validators.required],
    city: ['Madrid', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    genre: ['', Validators.required],
    price: [null as number | null],
    description: ['', [Validators.maxLength(500)]],
    contactEmail: ['', [Validators.email]],
    ticketUrl: [''],
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      this.loading.set(false);
      this.router.navigate(['/auth/login']);
      return;
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
        genre: v.genre,
        price: v.price != null && v.price > 0 ? String(v.price) : null,
        description: v.description,
        contact_email: v.contactEmail,
        ticket_url: v.ticketUrl,
      })
      .select('id')
      .single();

    this.loading.set(false);
    if (error) {
      this.error.set('Error al crear el evento. Inténtalo de nuevo.');
    } else {
      this.toast.success('Evento publicado correctamente.');
      this.router.navigate(['/events', data.id]);
    }
  }
}
