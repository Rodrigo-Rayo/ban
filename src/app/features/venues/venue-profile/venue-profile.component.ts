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
  selector: 'app-venue-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './venue-profile.component.html',
})
export class VenueProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  venue = signal<any>(null);
  reviews = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  avatarError = signal(false);

  showReviewForm = signal(false);
  reviewRating = 5;
  reviewComment = '';
  reviewLoading = signal(false);
  reviewError = signal<string | null>(null);
  myReview = signal<any>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);
  linkShared = signal(false);

  readonly avgRating = computed(() => {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  });

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: venue }, { data: { session } }, { data: reviews }] = await Promise.all([
        this.supabase.client.from('venues').select('*').eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'venue').eq('entity_id', id!).order('created_at', { ascending: false }),
      ]);
      this.venue.set(venue);
      if (venue) {
        this.seo.setProfile(venue.name, 'venue', venue.city, venue.description, venue.avatar_url);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'MusicVenue',
          name: venue.name,
          description: venue.description || '',
          image: venue.avatar_url || '',
          url:  + venue.id,
          address: { '@type': 'PostalAddress', addressLocality: venue.city || '', addressCountry: 'ES' },
        });
      }
      this.reviews.set(reviews || []);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set(reviews?.find((r: any) => r.user_id === session.user.id) || null);
        // isFav runs in background — doesn't block the UI
        if (venue) this.favSvc.isFavorite(session.user.id, 'venue', venue.id).then(v => this.isFav.set(v));
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
      this.isFav.set(await this.favSvc.toggle(this.currentUserId()!, 'venue', this.venue()!.id));
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
      entity_type: 'venue',
      entity_id: this.venue()!.id,
      rating: this.reviewRating,
      comment: this.reviewComment,
      author_name: authorName,
    }, { onConflict: 'user_id,entity_type,entity_id' });
    if (error) {
      this.reviewError.set(error.message || 'Error al guardar la reseña');
    } else {
      const { data } = await this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'venue').eq('entity_id', this.venue()!.id).order('created_at', { ascending: false });
      this.reviews.set(data || []);
      this.myReview.set(data?.find((r: any) => r.user_id === this.currentUserId()) || null);
      this.showReviewForm.set(false);
    }
    this.reviewLoading.set(false);
  }

  async sendMessage() {
    const uid = this.currentUserId();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (uid === this.venue()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.venue()!.user_id, this.venue()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.venue()!.name } });
  }

  async shareLink() {
    const url = `${window.location.origin}/venues/${this.venue()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.venue()!.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
