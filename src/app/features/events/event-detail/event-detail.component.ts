import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { localToday } from '../../../core/utils/date';

const RELATED_COLUMNS = 'id, title, venue, city, date, time, genre, price';
const RELATED_LIMIT = 3;
const EVENT_COLUMNS = 'id, user_id, title, venue, city, date, time, genre, price, description, contact_email, ticket_url';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-event-detail',
    imports: [RouterLink, CommonModule, DatePipe, IconComponent],
    templateUrl: './event-detail.component.html'
})
export class EventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  event = signal<any>(null);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isFav = signal(false);
  favLoading = signal(false);
  linkShared = signal(false);
  related = signal<any[]>([]);

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
      const [{ data }, { data: { session } }] = await Promise.all([
        this.supabase.client.from('events').select(EVENT_COLUMNS).eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
      ]);
      this.event.set(data);
      if (data) {
        void this.loadRelated(data);
        this.seo.setEvent(data.title, data.date, data.city, data.description);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: data.title,
          description: data.description || '',
          startDate: data.time ? `${data.date}T${data.time}` : data.date,
          endDate: data.time ? `${data.date}T${data.time}` : data.date,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          url: `https://bandyou.es/events/${data.id}`,
          location: {
            '@type': 'Place',
            name: data.venue || data.city || 'España',
            address: { '@type': 'PostalAddress', addressLocality: data.city || '', addressCountry: 'ES' },
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

  async toggleFav() {
    const uid = this.currentUserId();
    if (!uid) { this.router.navigate(['/auth/login']); return; }
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
