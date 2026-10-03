import { ReportLinkComponent } from '../../../shared/components/report-link/report-link.component';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../../shared/components/avatar-upload/avatar-upload.component';
import { avatarColor } from '../../../core/utils/display.utils';
import { Teacher, Review } from '../../../core/models';
import { formatLongDate, localToday } from '../../../core/utils/date';
import { LESSON_REQUEST_TITLE, lessonRequestBody } from '../../../core/utils/notification-copy';

const TEACHER_COLUMNS = 'id, user_id, name, instrument, city, description, avatar_url, hourly_rate, experience_years, level, modality, website_url, youtube_url';

@Component({
    selector: 'app-teacher-profile',
    imports: [ReportLinkComponent, RouterLink, FormsModule, IconComponent, AvatarUploadComponent],
    templateUrl: './teacher-profile.component.html'
})
export class TeacherProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private notifSvc = inject(NotificationsService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  teacher = signal<Teacher | null>(null);
  avatarError = signal(false);

  toggleBookingForm() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    this.showBookingForm.set(!this.showBookingForm());
  }
  reviews = signal<Review[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  reviewError = signal<string | null>(null);
  myReview = signal<Review | null>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);
  showBookingForm = signal(false);
  bookingDate = '';
  bookingTime = '';
  bookingMessage = '';
  bookingLoading = signal(false);
  bookingSuccess = signal(false);
  linkShared = signal(false);

  readonly posterLine = computed(() => ['Clases', this.teacher()?.instrument, this.teacher()?.city].filter(Boolean).join(' · '));
  readonly avgRating = computed(() => {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  });

  /** Signed-in user owns this profile. */
  readonly isOwner = computed(() => {
    const uid = this.currentUserId();
    const owner = this.teacher()?.user_id;
    return !!uid && !!owner && uid === owner;
  });
  /** Can write to the owner: someone else's profile that has an account behind it. */
  readonly canMessage = computed(() => !this.isOwner() && !!this.teacher()?.user_id);

  onPhotoUploaded(url: string) {
    this.teacher.update(v => (v ? { ...v, avatar_url: url } : v));
    this.avatarError.set(false);
  }

  /** Logged-out visitors go to login and come back to this profile afterwards. */
  goToLogin() {
    try { sessionStorage.setItem('bandyou_return_url', window.location.pathname); } catch { /* storage blocked */ }
    this.router.navigate(['/auth/login']);
  }

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: teacher }, { data: { session } }, { data: reviews }] = await Promise.all([
        this.supabase.client.from('teachers').select(TEACHER_COLUMNS).eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'teacher').eq('entity_id', id!).order('created_at', { ascending: false }).limit(200),
      ]);
      this.teacher.set(teacher as Teacher | null);
      if (teacher) {
        this.seo.setProfile(teacher.name, 'teacher', teacher.city, teacher.description, teacher.avatar_url, undefined, teacher.instrument);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: teacher.name,
          description: teacher.description || '',
          image: teacher.avatar_url || '',
          url: `https://www.bandyou.es/teachers/${teacher.id}`,
          hasOccupation: {
            '@type': 'Occupation',
            name: teacher.instrument ? ('Profesor de ' + teacher.instrument) : 'Profesor de música',
          },
          address: { '@type': 'PostalAddress', addressLocality: teacher.city || '', addressCountry: 'ES' },
        });
      } else {
        this.seo.setNotFound();
      }
      this.reviews.set((reviews || []) as Review[]);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set((reviews?.find((r: any) => r.user_id === session.user.id) || null) as Review | null);
        if (teacher) this.favSvc.isFavorite(session.user.id, 'teacher', teacher.id).then(v => this.isFav.set(v)).catch(() => { /* non-critical background check */ });
      }
    } catch {
      this.toast.error('No se pudo cargar el perfil. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
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
    return (await this.getProfileName()) || 'Usuario';
  }

  /** Signed-in user's display name; get_profile_name covers every role, including listeners (profiles.name). */
  private async getProfileName(): Promise<string | null> {
    const uid = this.currentUserId();
    if (!uid) return null;
    const { data } = await this.supabase.client.rpc('get_profile_name', { p_user_id: uid });
    return (data as string | null) || null;
  }

  /** Tells the teacher a lesson request arrived. Never to yourself. */
  private async notifyLessonRequest(longDate: string): Promise<void> {
    const teacher = this.teacher();
    if (!teacher?.user_id || teacher.user_id === this.currentUserId()) return;
    const name = await this.getProfileName();
    await this.notifSvc.create(
      teacher.user_id, 'booking', LESSON_REQUEST_TITLE, lessonRequestBody(name, longDate), 'teacher', teacher.id);
  }

  async submitReview() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    this.reviewLoading.set(true);
    this.reviewError.set(null);
    try {
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
        this.reviewError.set('No se pudo guardar la reseña. Inténtalo de nuevo.');
      } else {
        const { data } = await this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'teacher').eq('entity_id', this.teacher()!.id).order('created_at', { ascending: false }).limit(200);
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

  get minDate() { return localToday(); }

  async submitBooking() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    if (!this.bookingDate) return;
    this.bookingLoading.set(true);
    try {
      const date = formatLongDate(this.bookingDate);
      const time = this.bookingTime ? `\nHora preferida: ${this.bookingTime}` : '';
      const note = this.bookingMessage ? `\n\nMensaje: ${this.bookingMessage}` : '';
      const text = `Solicitud de clase\n\nFecha: ${date}${time}${note}`;
      const result = await this.messagesService.getOrCreateConversation(this.teacher()!.user_id, this.teacher()!.name);
      if (!result || 'error' in result) {
        this.toast.error(result && 'error' in result ? result.error : 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
        return;
      }
      await this.messagesService.sendMessage(result.id, text);
      // Best effort: the request already went out as a message.
      this.notifyLessonRequest(date).catch(() => undefined);
      this.bookingDate = '';
      this.bookingTime = '';
      this.bookingMessage = '';
      this.showBookingForm.set(false);
      this.bookingSuccess.set(true);
      setTimeout(() => this.bookingSuccess.set(false), 5000);
    } catch {
      this.toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      this.bookingLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    if (!uid) { this.goToLogin(); return; }
    if (uid === this.teacher()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    try {
      const result = await this.messagesService.getOrCreateConversation(this.teacher()!.user_id, this.teacher()!.name);
      if (!result) return;
      if ('error' in result) { this.msgError.set(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: this.teacher()!.name } });
    } catch {
      this.msgError.set('No se pudo abrir el chat. Inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  async shareLink() {
    const url = `${window.location.origin}/teachers/${this.teacher()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.teacher()!.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
