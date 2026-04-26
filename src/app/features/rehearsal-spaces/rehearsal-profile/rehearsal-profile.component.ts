import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';

@Component({
  selector: 'app-rehearsal-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './rehearsal-profile.component.html',
})
export class RehearsalProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private notifSvc = inject(NotificationsService);

  space = signal<any>(null);
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);

  sending = signal(false);
  msgError = signal<string | null>(null);
  showBookingForm = signal(false);
  bookingLoading = signal(false);
  bookingSuccess = signal(false);
  bookingName = '';
  bookingPhone = '';
  bookingDate = '';
  bookingStart = '';
  bookingEnd = '';
  bookingMessage = '';

  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  myReview = signal<any>(null);

  get avgRating() {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  }

  get minDate() {
    return new Date().toISOString().split('T')[0];
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const [{ data: space }, { data: { session } }, { data: reviews }] = await Promise.all([
      this.supabase.client.from('rehearsal_spaces').select('*').eq('id', id!).single(),
      this.supabase.auth.getSession(),
      this.supabase.client.from('reviews').select('*').eq('entity_type', 'rehearsal').eq('entity_id', id!).order('created_at', { ascending: false }),
    ]);
    this.space.set(space);
    this.reviews.set(reviews || []);
    if (session) {
      this.currentUserId.set(session.user.id);
      this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
      if (space) this.isFav.set(await this.favSvc.isFavorite(session.user.id, 'rehearsal', space.id));
    }
    this.loading.set(false);
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    this.isFav.set(await this.favSvc.toggle(this.currentUserId()!, 'rehearsal', this.space()!.id));
    this.favLoading.set(false);
  }

  async submitBooking() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.bookingLoading.set(true);
    const { error } = await this.supabase.client.from('rehearsal_bookings').insert({
      space_id: this.space()!.id,
      user_id: this.currentUserId(),
      date: this.bookingDate,
      start_time: this.bookingStart,
      end_time: this.bookingEnd,
      name: this.bookingName,
      phone: this.bookingPhone,
      message: this.bookingMessage,
    });
    this.bookingLoading.set(false);
    if (!error) {
      this.bookingSuccess.set(true);
      this.showBookingForm.set(false);
      if (this.space()?.user_id) {
        await this.notifSvc.create(
          this.space()!.user_id, 'booking',
          'Nueva solicitud de reserva',
          `${this.bookingName} quiere reservar el ${this.bookingDate} de ${this.bookingStart} a ${this.bookingEnd}`,
          'rehearsal', this.space()!.id
        );
      }
    }
  }

  async submitReview() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.reviewLoading.set(true);
    await this.supabase.client.from('reviews').upsert({
      user_id: this.currentUserId(),
      entity_type: 'rehearsal',
      entity_id: this.space()!.id,
      rating: this.reviewRating,
      comment: this.reviewComment,
    }, { onConflict: 'user_id,entity_type,entity_id' });
    const { data } = await this.supabase.client.from('reviews').select('*').eq('entity_type', 'rehearsal').eq('entity_id', this.space()!.id).order('created_at', { ascending: false });
    this.reviews.set(data || []);
    this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
    this.showReviewForm.set(false);
    this.reviewLoading.set(false);
  }

  async sendMessage() {
    const session = (await this.supabase.auth.getSession()).data.session;
    if (!session) { this.router.navigate(['/auth/login']); return; }
    if (session.user.id === this.space()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.space()!.user_id, this.space()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.space()!.name } });
  }
}
