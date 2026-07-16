import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-rehearsal-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './rehearsal-profile.component.html',
})
export class RehearsalProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private notifSvc = inject(NotificationsService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  space = signal<any>(null);

  toggleBookingForm() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.showBookingForm.set(!this.showBookingForm());
  }
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
  bookingError = signal<string | null>(null);
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
  reviewError = signal<string | null>(null);
  myReview = signal<any>(null);
  linkShared = signal(false);

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
      this.supabase.client.from('rehearsal_spaces').select('*').eq('id', id!).maybeSingle(),
      this.supabase.auth.getSession(),
      this.supabase.client.from('reviews').select('*').eq('entity_type', 'rehearsal').eq('entity_id', id!).order('created_at', { ascending: false }),
    ]);
    this.space.set(space);
    if (space) this.seo.setProfile(space.name, 'rehearsal', space.city, space.description, space.avatar_url);
    this.reviews.set(reviews || []);
    if (session) {
      this.currentUserId.set(session.user.id);
      this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
      // isFav runs in background — doesn't block the UI
      if (space) this.favSvc.isFavorite(session.user.id, 'rehearsal', space.id).then(v => this.isFav.set(v));
    }
    this.loading.set(false);
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

  async submitBooking() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.bookingLoading.set(true);
    this.bookingError.set(null);
    try {
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
      if (error) {
        this.bookingError.set('No se pudo enviar la solicitud. Inténtalo de nuevo.');
      } else {
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
    } finally {
      this.bookingLoading.set(false);
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
      this.reviewError.set(error.message || 'Error al guardar la reseña');
    } else {
      const { data } = await this.supabase.client.from('reviews').select('*').eq('entity_type', 'rehearsal').eq('entity_id', this.space()!.id).order('created_at', { ascending: false });
      this.reviews.set(data || []);
      this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
      this.showReviewForm.set(false);
    }
    this.reviewLoading.set(false);
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

  private readonly AVATAR_COLORS = [
    '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
  ];
  avatarColor(name: string): string {
    const code = name?.charCodeAt(0) ?? 65;
    return this.AVATAR_COLORS[code % this.AVATAR_COLORS.length];
  }
}
