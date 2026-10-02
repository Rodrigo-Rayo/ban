import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarColor } from '../../../core/utils/display.utils';
import { parseList } from '../../../core/utils/list';
import { Venue, Review } from '../../../core/models';
import { ListPipe } from '../../../shared/pipes/list.pipe';

const VENUE_COLUMNS = 'id, user_id, name, city, address, description, avatar_url, capacity, genres, contact_email, instagram_url, website_url, phone';

@Component({
    selector: 'app-venue-profile',
    imports: [RouterLink, FormsModule, IconComponent, ListPipe],
    templateUrl: './venue-profile.component.html'
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

  venue = signal<Venue | null>(null);
  reviews = signal<Review[]>([]);
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
  myReview = signal<Review | null>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);
  linkShared = signal(false);

  readonly posterLine = computed(() => [this.venue()?.city, ...parseList(this.venue()?.genres).slice(0, 2)].filter(Boolean).join(' · '));
  readonly avgRating = computed(() => {
    const r = this.reviews();
    if (!r.length) return null;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  });

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [{ data: venue }, { data: { session } }, { data: reviews }] = await Promise.all([
        this.supabase.client.from('venues').select(VENUE_COLUMNS).eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'venue').eq('entity_id', id!).order('created_at', { ascending: false }).limit(200),
      ]);
      this.venue.set(venue as Venue | null);
      if (venue) {
        this.seo.setProfile(venue.name, 'venue', venue.city, venue.description, venue.avatar_url);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'MusicVenue',
          name: venue.name,
          description: venue.description || '',
          image: venue.avatar_url || '',
          url: `https://bandyou.es/venues/${venue.id}`,
          address: { '@type': 'PostalAddress', addressLocality: venue.city || '', addressCountry: 'ES' },
        });
      } else {
        this.seo.setNotFound();
      }
      this.reviews.set((reviews || []) as Review[]);
      if (session) {
        this.currentUserId.set(session.user.id);
        this.myReview.set((reviews?.find((r: any) => r.user_id === session.user.id) || null) as Review | null);
        // isFav runs in background — doesn't block the UI
        if (venue) this.favSvc.isFavorite(session.user.id, 'venue', venue.id).then(v => this.isFav.set(v)).catch(() => { /* non-critical background check */ });
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
        entity_type: 'venue',
        entity_id: this.venue()!.id,
        rating: this.reviewRating,
        comment: this.reviewComment,
        author_name: authorName,
      }, { onConflict: 'user_id,entity_type,entity_id' });
      if (error) {
        this.reviewError.set('No se pudo guardar la reseña. Inténtalo de nuevo.');
      } else {
        const { data } = await this.supabase.client.from('reviews').select('id,user_id,rating,comment,author_name,created_at').eq('entity_type', 'venue').eq('entity_id', this.venue()!.id).order('created_at', { ascending: false }).limit(200);
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
    if (uid === this.venue()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    try {
      const result = await this.messagesService.getOrCreateConversation(this.venue()!.user_id, this.venue()!.name);
      if (!result) return;
      if ('error' in result) { this.msgError.set(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: this.venue()!.name } });
    } catch {
      this.msgError.set('No se pudo abrir el chat. Inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  async shareLink() {
    const url = `${window.location.origin}/venues/${this.venue()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.venue()!.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
