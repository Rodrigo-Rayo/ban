import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
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
  private supabase = inject(SupabaseService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  event = signal<any>(null);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  isGoing = signal(false);
  rsvpCount = signal(0);
  rsvpLoading = signal(false);
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
        // RSVP count and user RSVP status run in parallel after render
        const [{ count }, { data: myRsvp }] = await Promise.all([
          this.supabase.client.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('event_id', id!),
          this.supabase.client.from('event_rsvps').select('id').eq('event_id', id!).eq('user_id', session.user.id).maybeSingle(),
        ]);
        this.rsvpCount.set(count ?? 0);
        this.isGoing.set(!!myRsvp);
      }
    } catch {
      this.toast.error('No se pudo cargar el evento. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleRsvp() {
    const userId = this.currentUserId();
    const eventId = this.event()?.id;
    if (!userId || !eventId) return;
    this.rsvpLoading.set(true);
    if (this.isGoing()) {
      const { error } = await this.supabase.client.from('event_rsvps')
        .delete().eq('event_id', eventId).eq('user_id', userId);
      if (!error) { this.isGoing.set(false); this.rsvpCount.update(n => Math.max(0, n - 1)); }
      else { this.toast.error('No se pudo actualizar tu asistencia. Inténtalo de nuevo.'); }
    } else {
      const { error } = await this.supabase.client.from('event_rsvps')
        .insert({ event_id: eventId, user_id: userId });
      if (!error) { this.isGoing.set(true); this.rsvpCount.update(n => n + 1); this.toast.success('¡Apuntado al evento!'); }
      else { this.toast.error('No se pudo confirmar tu asistencia. Inténtalo de nuevo.'); }
    }
    this.rsvpLoading.set(false);
  }
}
