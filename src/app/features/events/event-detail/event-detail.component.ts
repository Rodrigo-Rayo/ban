import { Component, inject, signal, OnInit } from '@angular/core';
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

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const [{ data }, { data: { session } }] = await Promise.all([
      this.supabase.client.from('events').select('*').eq('id', id!).maybeSingle(),
      this.supabase.auth.getSession(),
    ]);
    this.event.set(data);
    if (data) this.seo.setEvent(data.title, data.date, data.city, data.description);
    if (session) this.currentUserId.set(session.user.id);
    this.loading.set(false);

    // RSVP count and user RSVP status run in parallel after render
    const [{ count }, { data: myRsvp }] = await Promise.all([
      this.supabase.client.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('event_id', id!),
      session
        ? this.supabase.client.from('event_rsvps').select('id').eq('event_id', id!).eq('user_id', session.user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    this.rsvpCount.set(count ?? 0);
    this.isGoing.set(!!myRsvp);
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
      else { this.toast.error('No se pudo actualizar. Asegúrate de que la tabla event_rsvps existe en Supabase.'); }
    } else {
      const { error } = await this.supabase.client.from('event_rsvps')
        .insert({ event_id: eventId, user_id: userId });
      if (!error) { this.isGoing.set(true); this.rsvpCount.update(n => n + 1); this.toast.success('¡Apuntado al evento!'); }
      else { this.toast.error('No se pudo apuntar. Asegúrate de que la tabla event_rsvps existe en Supabase.'); }
    }
    this.rsvpLoading.set(false);
  }
}
