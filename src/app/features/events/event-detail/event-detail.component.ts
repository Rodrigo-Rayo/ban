import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ReportLinkComponent } from '../../../shared/components/report-link/report-link.component';
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { formatLongDate, formatTime, localToday } from '../../../core/utils/date';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { Event as AppEvent } from '../../../core/models';
import { mapsUrl } from '../../../core/utils/maps';
import { ShareCard, StoryImage, shareImage, slugFile } from '../../../core/utils/share-card';
import { storyFeedback } from '../../../core/utils/story-feedback';

const RELATED_COLUMNS = 'id, title, venue, city, date, time, genre, price';
const RELATED_LIMIT = 3;
const EVENT_COLUMNS = 'id, user_id, title, venue, city, date, time, genre, price, description, contact_email, ticket_url';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-event-detail',
    imports: [ReportLinkComponent, RouterLink, CommonModule, DatePipe, IconComponent],
    templateUrl: './event-detail.component.html'
})
export class EventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private media = inject(MediaUploadService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private features = inject(MediaFeaturesService);

  event = signal<any>(null);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  linkShared = signal(false);
  related = signal<any[]>([]);
  deleting = signal(false);
  /** The poster failed to load: fall back to the text-only cartel. */
  posterError = signal(false);

  readonly posterUrl = computed(() => (this.posterError() ? null : (this.event()?.image_url as string | null | undefined) || null));

  readonly longDate = formatLongDate;
  readonly time = formatTime;

  /** The organizer manages the event; they cannot favorite it. */
  readonly isOwner = computed(() => {
    const uid = this.currentUserId();
    return !!uid && uid === this.event()?.user_id;
  });

  makingImage = signal(false);

  private readonly story = new StoryImage(() => this.storyCard());

  /** Story-sized poster of this gig, for Instagram/WhatsApp. */
  private storyCard(): ShareCard | null {
    const e = this.event();
    if (!e?.date) return null;
    const [y, m, d] = e.date.slice(0, 10).split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', o).format(day).replace('.', '');
    return {
      kicker: ['Concierto', e.city].filter(Boolean).join(' · '),
      title: e.title,
      lines: [e.venue, e.time ? `${formatTime(e.time)} h` : ''],
      date: { weekday: fmt({ weekday: 'short' }), day: String(d), month: fmt({ month: 'short' }) },
    };
  }

  /** Share sheet (Instagram, WhatsApp…) or download. */
  async shareStory() {
    const e = this.event();
    if (!e || this.makingImage()) return;
    this.makingImage.set(true);
    try {
      const blob = await this.story.blob();
      const result = await shareImage(blob, slugFile(`${e.title} ${e.city ?? ''}`), `https://www.bandyou.es/events/${e.id}`);
      storyFeedback(result, this.toast);
    } catch {
      this.toast.error('No se pudo crear la imagen.');
    } finally {
      this.makingImage.set(false);
    }
  }

  /** "Cómo llegar": works without an address too (venue + province). */
  readonly directionsUrl = computed(() => {
    const e = this.event();
    return e ? mapsUrl([e.venue, e.address, e.city]) : '';
  });

  readonly priceLabel = computed(() => {
    const price = this.event()?.price;
    if (!price) return '';
    return +price > 0 ? `${price} €` : String(price);
  });

  readonly isPast = computed(() => {
    const e = this.event();
    if (!e?.date) return false;
    return e.date < localToday();
  });

  async shareLink() {
    const ev = this.event();
    if (!ev) return;
    const url = `${window.location.origin}/events/${ev.id}`;
    if (navigator.share) {
      await navigator.share({ title: ev.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    try {
      // image_url and address are only requested once their columns exist (cached per session).
      const [hasImage, hasAddress] = await Promise.all([this.features.has('eventImage'), this.features.has('eventAddress')]);
      const columns = [EVENT_COLUMNS, hasImage ? 'image_url' : '', hasAddress ? 'address' : ''].filter(Boolean).join(', ');
      const [{ data }, { data: { session } }] = await Promise.all([
        this.supabase.client.from('events').select(columns).eq('id', id!).maybeSingle<AppEvent>(),
        this.supabase.auth.getSession(),
      ]);
      this.event.set(data);
      if (data) {
        this.story.prepare();
        void this.loadRelated(data);
        this.seo.setEvent(data.title, data.date, data.city, data.description ?? undefined);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: data.title,
          description: data.description || '',
          startDate: data.time ? `${data.date}T${data.time}` : data.date,
          endDate: data.time ? `${data.date}T${data.time}` : data.date,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          ...(data.image_url ? { image: data.image_url } : {}),
          url: `https://www.bandyou.es/events/${data.id}`,
          location: {
            '@type': 'Place',
            name: data.venue || data.city || 'España',
            address: {
              '@type': 'PostalAddress',
              ...(data.address ? { streetAddress: data.address } : {}),
              addressLocality: data.city || '',
              addressCountry: 'ES',
            },
          },
        });
      } else {
        this.seo.setNotFound();
      }
      if (session) {
        this.currentUserId.set(session.user.id);
        if (data) {
          this.favSvc.isFavorite(session.user.id, 'event', data.id).then(v => this.isFav.set(v));
        }
      }
    } catch {
      this.toast.error('No se pudo cargar el evento. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Non-critical: next upcoming events, same city first. Failures hide the strip. */
  private async loadRelated(current: { id: string; city?: string | null }) {
    try {
      const today = localToday();
      const found: any[] = [];
      const fetchUpcoming = async (city: string | null) => {
        if (found.length >= RELATED_LIMIT) return;
        let q = this.supabase.client.from('events').select(RELATED_COLUMNS)
          .gte('date', today).neq('id', current.id);
        if (city) q = q.eq('city', city);
        const { data } = await q.order('date', { ascending: true }).limit(RELATED_LIMIT);
        if (!Array.isArray(data)) return;
        for (const item of data) {
          if (found.length < RELATED_LIMIT && !found.some(f => f.id === item.id)) found.push(item);
        }
      };
      await fetchUpcoming(current.city ?? null);
      await fetchUpcoming(null);
      this.related.set(found);
    } catch {
      this.related.set([]);
    }
  }

  async deleteEvent() {
    const ev = this.event();
    const uid = this.currentUserId();
    if (!ev || !uid || ev.user_id !== uid || this.deleting()) return;
    const ok = await this.confirm.ask({
      title: '¿Eliminar este evento?',
      message: 'Desaparece de la agenda y no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      const { error } = await this.supabase.client.from('events').delete().eq('id', ev.id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo eliminar el evento.'); return; }
      this.media.removeFiles([(ev as { image_url?: string | null }).image_url]);
      this.toast.success('Evento eliminado.');
      this.router.navigate(['/search'], { queryParams: { tab: 'events' } });
    } catch {
      this.toast.error('No se pudo eliminar el evento.');
    } finally {
      this.deleting.set(false);
    }
  }

  /** Logged-out visitors go to login and come back to this event afterwards. */
  rememberReturn() {
    try { sessionStorage.setItem('bandyou_return_url', window.location.pathname); } catch { /* storage blocked */ }
  }

  async toggleFav() {
    const uid = this.currentUserId();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (this.isOwner()) return;
    this.favLoading.set(true);
    try {
      const result = await this.favSvc.toggle(uid, 'event', this.event()!.id);
      this.isFav.set(result);
    } catch {
      this.toast.error('No se pudo actualizar favoritos. Inténtalo de nuevo.');
    } finally {
      this.favLoading.set(false);
    }
  }
}
