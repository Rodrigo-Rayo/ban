import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form.component.html',
})
export class EventFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  loading = signal(false);
  success = signal(false);
  error = signal('');

  genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Otro'];

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    venue: ['', Validators.required],
    city: ['Madrid', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    genre: ['', Validators.required],
    price: ['Gratis'],
    description: ['', [Validators.maxLength(500)]],
    contactEmail: ['', [Validators.email]],
    ticketUrl: [''],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { data: { user } } = await this.supabase.auth.getUser();
    const v = this.form.value;

    const { error } = await this.supabase.client
      .from('events')
      .insert({
        user_id: user?.id,
        title: v.title,
        venue: v.venue,
        city: v.city,
        date: v.date,
        time: v.time,
        genre: v.genre,
        price: v.price || 'Gratis',
        description: v.description,
        contact_email: v.contactEmail,
        ticket_url: v.ticketUrl,
      });

    this.loading.set(false);
    if (error) {
      this.error.set('Error al crear el evento. Inténtalo de nuevo.');
    } else {
      this.success.set(true);
    }
  }
}
