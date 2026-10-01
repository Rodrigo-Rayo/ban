import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarColor } from '../../../core/utils/display.utils';
import { RehearsalSpace, Review } from '../../../core/models';
import { localToday } from '../../../core/utils/date';

const REHEARSAL_COLUMNS = 'id, user_id, name, city, address, description, avatar_url, hourly_rate, capacity, opening_hours, instagram_url, website_url, phone';

@Component({
    selector: 'app-rehearsal-profile',
    imports: [RouterLink, FormsModule, IconComponent],
    templateUrl: './rehearsal-profile.component.html'
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
  private notifSvc = inject(NotificationsService);

  space = signal<RehearsalSpace | null>(null);
  avatarError = signal(false);
  reviews = signal<Review[]>([]);
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
  myReview = signal<Review | null>(null);
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
        this.supabase.client.from('rehearsal_spaces').select(REHEARSAL_COLUMNS).eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'rehearsal').eq('entity_id', id!).order('created_at', { ascending: false }).limit(200),
      ]);
      this.space.set(space as RehearsalSpace | null);
      if (space) {
        this.seo.setProfile(space.name, 'rehearsal', space.city, space.description, space.avatar_url);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: space.name,
          description: space.description || '',
          image: space.avatar_url || '',
          url: `https://bandyou.es/rehearsal/${space.id}`,
          address: { '@type': 'PostalAddress', addressLocality: space.city || '', addressCountry: 'ES' },
        });
      } else {
        this.seo.setNotFound();
      }
      this.reviews.set((reviews || []) as Review[]);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set((reviews?.find((r: any) => r.user_id === session.user.id) || null) as Review | null);
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
    // get_profile_name covers every role, including listeners (profiles.name).
    const { data } = await this.supabase.client.rpc('get_profile_name', { p_user_id: uid });
    return (data as string | null) || 'Usuario';
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
        const { data } = await this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'rehearsal').eq('entity_id', this.space()!.id).order('created_at', { ascending: false }).limit(200);
        this.reviews.set((data || []) as Review[]);
        this.myReview.set((data?.find((r: any) => r.user_id === this.currentUserId()) || null) as Review | null);
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
    try {
      const result = await this.messagesService.getOrCreateConversation(this.space()!.user_id, this.space()!.name);
      if (!result) return;
      if ('error' in result) { this.msgError.set(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: this.space()!.name } });
    } catch {
      this.msgError.set('No se pudo abrir el chat. Inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  readonly today = localToday();

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
        // Cancelled and rejected bookings free the slot. RLS only shows the caller's own
        // rows; the DB trigger in supabase/audit_2026_10_bookings_overlap.sql enforces it for everyone.
        .not('status', 'in', '(cancelled,rejected)');

      if (conflictError) {
        this.bookingError.set('No se pudo verificar la disponibilidad. Inténtalo de nuevo.');
        return;
      }

      const hasOverlap = (conflicts || []).some((c: { start_time: string; end_time: string }) =>
        // DB times are HH:MM:SS, inputs HH:MM — compare at minute precision.
        c.start_time.slice(0, 5) < this.bookingEndTime && c.end_time.slice(0, 5) > this.bookingStartTime
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
        // 23P01 = raised by trg_prevent_booking_overlap when someone else holds the slot.
        this.bookingError.set(error.code === '23P01'
          ? 'Ese horario ya está reservado. Elige otra hora.'
          : 'No se pudo solicitar la reserva. Inténtalo de nuevo.');
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
        // Best effort: the booking is stored even if the notification fails (rate limit…).
        const space = this.space()!;
        if (space.user_id) {
          this.notifSvc.create(space.user_id, 'booking', 'Nueva solicitud de reserva', `${name} quiere reservar ${space.name}`, 'rehearsal', space.id).catch(() => undefined);
        }
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
      await navigator.clipboard.writeText(url).catch(() => {});
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
