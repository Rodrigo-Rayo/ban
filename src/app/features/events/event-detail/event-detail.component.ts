import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe, IconComponent],
  templateUrl: './event-detail.component.html',
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

  readonly isPast = computed(() => {
    const e = this.event();
    if (!e?.date) return false;
    return e.date < new Date().toISOString().split('T')[0];
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
        this.supabase.client.from('events').select('*').eq('id', id!).maybeSingle(),
        this.supabase.auth.getSession(),
      ]);
      this.event.set(data);
      if (data) {
        this.seo.setEvent(data.title, data.date, data.city, data.description);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: data.title,
          description: data.description || '',
          startDate: data.date,
          url: `https://bandyou.es/events/${data.id}`,
          location: {
            '@type': 'Place',
            name: data.venue_name || data.city || 'España',
            address: { '@type': 'PostalAddress', addressLocality: data.city || '', addressCountry: 'ES' },
          },
        });
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
