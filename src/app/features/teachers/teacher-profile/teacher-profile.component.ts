import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './teacher-profile.component.html',
})
export class TeacherProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  teacher = signal<any>(null);
  avatarError = signal(false);

  toggleBookingForm() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.showBookingForm.set(!this.showBookingForm());
  }
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  reviewError = signal<string | null>(null);
  myReview = signal<any>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);
  showBookingForm = signal(false);
  bookingDate = '';
  bookingTime = '';
  bookingMessage = '';
  bookingLoading = signal(false);
  bookingSuccess = signal(false);
  linkShared = signal(false);

  get avgRating() {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  }

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: teacher }, { data: { session } }, { data: reviews }] = await Promise.all([
        this.supabase.client.from('teachers').select('*').eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('*').eq('entity_type', 'teacher').eq('entity_id', id!).order('created_at', { ascending: false }),
      ]);
      this.teacher.set(teacher);
      if (teacher) this.seo.setProfile(teacher.name, 'teacher', teacher.city, teacher.description, teacher.avatar_url);
      this.reviews.set(reviews || []);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
        if (teacher) this.favSvc.isFavorite(session.user.id, 'teacher', teacher.id).then(v => this.isFav.set(v));
      }
    } catch {
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    try {
      this.isFav.set(await this.favSvc.toggle(this.currentUserId()!, 'teacher', this.teacher()!.id));
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
    const authorName = await this.getAuthorName();
    const { error } = await this.supabase.client.from('reviews').upsert({
      user_id: this.currentUserId(),
      entity_type: 'teacher',
      entity_id: this.teacher()!.id,
      rating: this.reviewRating,
      comment: this.reviewComment,
      author_name: authorName,
    }, { onConflict: 'user_id,entity_type,entity_id' });
    if (error) {
      this.reviewError.set(error.message || 'Error al guardar la reseña');
    } else {
      const { data } = await this.supabase.client.from('reviews').select('*').eq('entity_type', 'teacher').eq('entity_id', this.teacher()!.id).order('created_at', { ascending: false });
      this.reviews.set(data || []);
      this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
      this.showReviewForm.set(false);
    }
    this.reviewLoading.set(false);
  }

  get minDate() { return new Date().toISOString().split('T')[0]; }

  async submitBooking() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    if (!this.bookingDate) return;
    this.bookingLoading.set(true);
    try {
      const text = `📅 Solicitud de clase\n\nFecha: ${this.bookingDate}${this.bookingTime ? '\nHora preferida: ' + this.bookingTime : ''}${this.bookingMessage ? '\n\nMensaje: ' + this.bookingMessage : ''}`;
      const result = await this.messagesService.getOrCreateConversation(this.teacher()!.user_id, this.teacher()!.name);
      if (result && !('error' in result)) {
        await this.messagesService.sendMessage(result.id, text);
        this.bookingDate = '';
        this.bookingTime = '';
        this.bookingMessage = '';
        this.showBookingForm.set(false);
        this.bookingSuccess.set(true);
        setTimeout(() => this.bookingSuccess.set(false), 5000);
      }
    } catch {
      this.toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      this.bookingLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (uid === this.teacher()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.teacher()!.user_id, this.teacher()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.teacher()!.name } });
  }

  async shareLink() {
    const url = `${window.location.origin}/teachers/${this.teacher()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.teacher()!.name, url }).catch(() => {});
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
