import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarColor } from '../../../core/utils/display.utils';

@Component({
  selector: 'app-rehearsal-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './rehearsal-profile.component.html',
})
export class RehearsalProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  space = signal<any>(null);
  avatarError = signal(false);
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);

  sending = signal(false);
  msgError = signal<string | null>(null);

  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  reviewError = signal<string | null>(null);
  myReview = signal<any>(null);
  linkShared = signal(false);

  // Booking form state
  showBookingForm = signal(false);
  bookingDate = '';
  bookingStartTime = '';
  bookingEndTime = '';
  bookingName = '';
  bookingPhone = '';
  bookingNotes = '';
  bookingLoading = signal(false);
  bookingDone = signal(false);
  bookingError = signal<string | null>(null);

  readonly avgRating = computed(() => {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  });

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: space }, { data: { session } }, { data: reviews }] = await Promise.all([
        this.supabase.client.from('rehearsal_spaces').select('*').eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'rehearsal').eq('entity_id', id!).order('created_at', { ascending: false }),
      ]);
      this.space.set(space);
      if (space) {
        this.seo.setProfile(space.name, 'rehearsal', space.city, space.description, space.avatar_url);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: space.name,
          description: space.description || '',
          image: space.avatar_url || '',
          url:  + space.id,
          address: { '@type': 'PostalAddress', addressLocality: space.city || '', addressCountry: 'ES' },
        });
      }
      this.reviews.set(reviews || []);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
        if (space) this.favSvc.isFavorite(session.user.id, 'rehearsal', space.id).then(v => this.isFav.set(v)).catch(() => { /* non-critical background check */ });
      }
    } catch {
      this.toast.error('No se pudo cargar el perfil. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    try {
      this.isFav.set(await this.favSvc.toggle(this.currentUserId()!, 'rehearsal', this.space()!.id));
    } catch {
      this.toast.error('No se pudo actualizar favoritos. Inténtalo de nuevo.');
    } finally {
      this.favLoading.set(false);
    }
  }

  private async getAuthorName(): Promise<string> {
    const uid = this.currentUserId();
    if (!uid) return 'Usuario';
    const results = await Promise.all(
      (['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] as const).map(t =>
        this.supabase.client.from(t).select('name').eq('user_id', uid).maybeSingle()
      )
    );
    for (const { data } of results) { if (data?.name) return data.name; }
    return 'Usuario';
  }

  async submitReview() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.reviewLoading.set(true);
    this.reviewError.set(null);
    try {
      const authorName = await this.getAuthorName();
      const { error } = await this.supabase.client.from('reviews').upsert({
        user_id: this.currentUserId(),
        entity_type: 'rehearsal',
        entity_id: this.space()!.id,
        rating: this.reviewRating,
        comment: this.reviewComment,
        author_name: authorName,
      }, { onConflict: 'user_id,entity_type,entity_id' });
      if (error) {
        this.reviewError.set('No se pudo guardar la reseña. Inténtalo de nuevo.');
      } else {
        const { data } = await this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'rehearsal').eq('entity_id', this.space()!.id).order('created_at', { ascending: false });
        this.reviews.set(data || []);
        this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
        this.showReviewForm.set(false);
      }
    } catch {
      this.reviewError.set('No se pudo guardar la reseña. Inténtalo de nuevo.');
    } finally {
      this.reviewLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (uid === this.space()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.space()!.user_id, this.space()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.space()!.name } });
  }

  readonly today = new Date().toISOString().split('T')[0];

  async submitBooking() {
    this.bookingError.set(null);
    if (!this.bookingDate || !this.bookingStartTime || !this.bookingEndTime) {
      this.bookingError.set('Por favor completa fecha, hora de inicio y hora de fin.');
      return;
    }
    if (this.bookingStartTime >= this.bookingEndTime) {
      this.bookingError.set('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    if (this.currentUserId() === this.space()!.user_id) {
      this.bookingError.set('No puedes reservar tu propio local.');
      return;
    }

    this.bookingLoading.set(true);

    try {
      // Overlap detection: query existing bookings for that date
      const { data: conflicts, error: conflictError } = await this.supabase.client
        .from('rehearsal_bookings')
        .select('start_time, end_time')
        .eq('space_id', this.space()!.id)
        .eq('date', this.bookingDate)
        .neq('status', 'cancelled');

      if (conflictError) {
        this.bookingError.set('No se pudo verificar la disponibilidad. Inténtalo de nuevo.');
        return;
      }

      const hasOverlap = (conflicts || []).some((c: { start_time: string; end_time: string }) =>
        c.start_time < this.bookingEndTime && c.end_time > this.bookingStartTime
      );

      if (hasOverlap) {
        this.bookingError.set('Ese horario ya está ocupado. Por favor elige otro.');
        return;
      }

      const name = this.bookingName.trim() || await this.getAuthorName();

      const { error } = await this.supabase.client
        .from('rehearsal_bookings')
        .insert({
          space_id:   this.space()!.id,
          user_id:    this.currentUserId(),
          date:       this.bookingDate,
          start_time: this.bookingStartTime,
          end_time:   this.bookingEndTime,
          name,
          phone:      this.bookingPhone.trim() || null,
          message:    this.bookingNotes.trim() || null,
          status:     'pending',
        });

      if (error) {
        this.bookingError.set('No se pudo solicitar la reserva. Inténtalo de nuevo.');
      } else {
        this.bookingDone.set(true);
        this.showBookingForm.set(false);
        this.bookingDate = '';
        this.bookingStartTime = '';
        this.bookingEndTime = '';
        this.bookingName = '';
        this.bookingPhone = '';
        this.bookingNotes = '';
        this.toast.success('¡Solicitud enviada! El local confirmará tu reserva.');
      }
    } catch {
      this.bookingError.set('No se pudo solicitar la reserva. Inténtalo de nuevo.');
    } finally {
      this.bookingLoading.set(false);
    }
  }

  async shareLink() {
    const url = `${window.location.origin}/rehearsal/${this.space()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.space()!.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
