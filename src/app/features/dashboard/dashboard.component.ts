import { Component, ElementRef, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { MessagesService } from '../../core/services/messages.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { CITIES } from '../../core/constants/cities';
import { timeAgo } from '../../core/utils/display.utils';
import { environment } from '../../../environments/environment';
import { Event as AppEvent, EventGenre, Post, GearListing } from '../../core/models';
import { localToday } from '../../core/utils/date';

interface DashboardProfile {
  id?: string;
  user_id?: string;
  name: string;
  city?: string | null;
  avatar_url?: string | null;
  genre?: string | null;
  genres?: string | null;
  instrument?: string | null;
  hourly_rate?: number | null;
  capacity?: number | null;
  looking_for?: string | null;
  contact_email?: string | null;
  description?: string | null;
}

interface DashboardPost {
  id: string;
  type: string;
  text: string;
  city: string | null;
  created_at: string;
}

interface DashboardListing {
  id: string;
  title: string;
  price: number | null;
  status: string;
  images: string[] | null;
  condition: string | null;
  category: string | null;
  created_at: string;
}

interface SpaceBooking {
  id: string;
  name: string;
  phone?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  message?: string | null;
  status: string;
}

interface MyBooking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  name: string;
  status: string;
  space_id?: string | null;
  message?: string | null;
  rehearsal_spaces?: { name: string; city: string } | null;
}

interface SidebarPost {
  id: string;
  type: string;
  text: string;
  city: string | null;
  author_name: string;
  created_at: string;
}

interface SidebarEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string | null;
  genre: string;
}

@Component({
    selector: 'app-dashboard',
    imports: [RouterLink, CommonModule, DatePipe, FormsModule],
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  readonly timeAgo = timeAgo;

  auth          = inject(AuthService);
  private supabase = inject(SupabaseService);
  private seo   = inject(SeoService);
  notifSvc      = inject(NotificationsService);
  messagesService = inject(MessagesService);
  private toast = inject(ToastService);

  profile    = signal<DashboardProfile | null>(null);
  profileType = signal('');
  events     = signal<AppEvent[]>([]);
  myPosts    = signal<DashboardPost[]>([]);
  myListings = signal<DashboardListing[]>([]);
  bookings      = signal<SpaceBooking[]>([]);
  myBookings    = signal<MyBooking[]>([]);
  sidebarPosts  = signal<SidebarPost[]>([]);
  sidebarEvents = signal<SidebarEvent[]>([]);
  loading    = signal(true);
  uploadingAvatar = signal(false);
  activeTab  = signal('events');
  linkCopied = signal(false);
  /** Inline event edit: title left empty on save attempt. */
  editTitleError = signal(false);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  deletingAccount = signal(false);
  showDeleteConfirm = signal(false);
  deleteConfirmText = signal('');
  editingEventId = signal<string | null>(null);
  editEventData: {
    title: string; venue: string; city: string; date: string;
    time: string; genre: string; price: string | null;
    description: string; contact_email: string; ticket_url: string;
  } = { title: '', venue: '', city: '', date: '', time: '', genre: '', price: null, description: '', contact_email: '', ticket_url: '' };
  editSaving = signal(false);
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Otro'];
  readonly cities = CITIES;

  async ngOnInit() {
    this.seo.set({ title: 'Mi panel' });
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [
        { data: musician, error: e1 }, { data: band, error: e2 }, { data: venue, error: e3 },
        { data: teacher, error: e4 }, { data: rehearsal, error: e5 }, { data: evs },
        { data: posts },   { data: listings },
        { data: sbPosts }, { data: sbEvents },
        { data: userBookings }, { data: profileRow },
      ] = await Promise.all([
        this.supabase.client.from('musicians').select('id,name,city,avatar_url,genre,instrument,description,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('bands').select('id,name,city,avatar_url,genre,description,looking_for,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('venues').select('id,name,city,avatar_url,genres,description,capacity,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('teachers').select('id,name,city,avatar_url,instrument,hourly_rate,description,modality,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('rehearsal_spaces').select('id,name,city,avatar_url,capacity,hourly_rate,description,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('events').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(50),
        this.supabase.client.from('posts').select('id, type, text, city, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
        this.supabase.client.from('gear_listings').select('id, title, price, status, images, condition, category, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
        this.supabase.client.from('posts').select('id, type, text, city, author_name, created_at').order('created_at', { ascending: false }).limit(5),
        this.supabase.client.from('events').select('id, title, venue, city, date, time, genre').gte('date', localToday()).order('date', { ascending: true }).limit(4),
        this.supabase.client.from('rehearsal_bookings').select('id, date, start_time, end_time, name, status, space_id, rehearsal_spaces(name, city)').eq('user_id', uid).order('date', { ascending: true }).limit(100),
        this.supabase.client.from('profiles').select('role, name').eq('id', uid).maybeSingle(),
      ]);
      if (e1 || e2 || e3 || e4 || e5) {
        this.toast.error('Error al cargar el panel. Recarga la página.');
        return;
      }

      if (musician)       { this.profile.set(musician);  this.profileType.set('musician'); }
      else if (band)      { this.profile.set(band);       this.profileType.set('band'); }
      else if (venue)     { this.profile.set(venue);      this.profileType.set('venue'); }
      else if (teacher)   { this.profile.set(teacher);    this.profileType.set('teacher'); }
      else if (rehearsal) { this.profile.set(rehearsal);  this.profileType.set('rehearsal'); }
      else if (profileRow?.role === 'listener') {
        this.profile.set({ name: profileRow.name });
        this.profileType.set('listener');
      }

      this.events.set(evs || []);
      this.myPosts.set(posts || []);
      this.myListings.set(listings || []);
      this.sidebarPosts.set(sbPosts || []);
      this.sidebarEvents.set(sbEvents || []);
      this.myBookings.set((userBookings || []) as unknown as MyBooking[]);

      if (this.profileType() === 'rehearsal' && this.profile()) {
        this.activeTab.set('bookings');
        this.loadBookings().catch(err => { if (!environment.production) console.error('[Dashboard] loadBookings failed:', err); });
      }
    } catch {
      this.toast.error('Error al cargar el panel. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadBookings() {
    const p = this.profile();
    if (!p) return;
    const today = localToday();
    const { data, error } = await this.supabase.client
      .from('rehearsal_bookings').select('id,user_id,space_id,name,phone,date,start_time,end_time,message,status')
      .eq('space_id', p.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(100);
    if (error) { this.toast.error('No se pudieron cargar las reservas.'); return; }
    this.bookings.set(data || []);
  }

  async updateBookingStatus(id: string, status: string) {
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
    if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      this.toast.error('Estado de reserva no válido.');
      return;
    }
    try {
      const { error } = await this.supabase.client.from('rehearsal_bookings').update({ status }).eq('id', id);
      if (error) { this.toast.error('No se pudo actualizar el estado de la reserva.'); return; }
      this.bookings.update(bs => bs.map(b => b.id === id ? { ...b, status } : b));
      this.toast.success('Estado de la reserva actualizado.');
      const booking = this.bookings().find(b => b.id === id) as { user_id?: string; space_id?: string; date?: string } | undefined;
      if (booking?.user_id && (status === 'confirmed' || status === 'rejected')) {
        const title = status === 'confirmed' ? 'Reserva confirmada' : 'Reserva rechazada';
        this.notifSvc.create(booking.user_id, 'booking', title, booking.date ? `Reserva del ${booking.date}` : undefined, 'rehearsal', booking.space_id).catch(() => undefined);
      }
    } catch {
      this.toast.error('No se pudo actualizar el estado de la reserva.');
    }
  }

  async uploadAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      this.toast.error('Solo se permiten imágenes JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('La imagen no puede superar 5 MB.');
      return;
    }
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;
    this.uploadingAvatar.set(true);
    try {
      const path = `${session.user.id}/avatar`;
      const { error } = await this.supabase.client.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.');
      } else {
        const { data: urlData } = this.supabase.client.storage.from('avatars').getPublicUrl(path);
        const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        const table: Record<string, string> = { musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal_spaces' };
        if (table[this.profileType()]) {
          const { error: dbErr } = await this.supabase.client.from(table[this.profileType()]).update({ avatar_url: avatarUrl }).eq('user_id', session.user.id);
          if (dbErr) {
            this.toast.error('Foto subida pero no se pudo guardar. Inténtalo de nuevo.');
          } else {
            this.profile.update(p => p ? { ...p, avatar_url: avatarUrl } : p);
            this.toast.success('Foto de perfil actualizada.');
          }
        }
      }
    } catch {
      this.toast.error('No se pudo subir la imagen. Inténtalo de nuevo.');
    } finally {
      this.uploadingAvatar.set(false);
    }
  }


  private sanitizeUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      const parsed = new URL(value);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? value : null;
    } catch {
      return null;
    }
  }

  /** Shortened text for unique, readable accessible names. */
  shortLabel(text: string | null | undefined, max = 40): string {
    const t = (text ?? '').trim();
    return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
  }

  private focusSoon(selector: string) {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }

  startEditEvent(event: AppEvent, e: Event) {
    e.preventDefault(); e.stopPropagation();
    this.editTitleError.set(false);
    this.editingEventId.set(event.id);
    this.focusSoon('#edit-event-title');
    this.editEventData = {
      title: event.title,
      venue: event.venue,
      city: event.city,
      date: event.date,
      time: event.time?.slice(0, 5) ?? '',
      genre: event.genre,
      price: event.price,
      description: event.description ?? '',
      contact_email: event.contact_email ?? '',
      ticket_url: event.ticket_url ?? '',
    };
  }

  cancelEditEvent() {
    const id = this.editingEventId();
    this.editingEventId.set(null);
    // Return focus to the edit button of the row we came from.
    if (id) this.focusSoon(`[data-edit-event="${id}"]`);
  }

  async saveEditEvent(id: string) {
    if (!this.editEventData.title?.trim()) {
      this.editTitleError.set(true);
      this.focusSoon('#edit-event-title');
      return;
    }
    this.editTitleError.set(false);
    const uid = this.auth.user()?.id;
    if (!uid) return;
    this.editSaving.set(true);
    try {
      const { error } = await this.supabase.client.from('events').update({
        title: this.editEventData.title,
        venue: this.editEventData.venue,
        city: this.editEventData.city,
        // date/time are NOT NULL: keep the stored values when the inputs are cleared.
        ...(this.editEventData.date ? { date: this.editEventData.date } : {}),
        ...(this.editEventData.time ? { time: this.editEventData.time } : {}),
        genre: this.editEventData.genre,
        price: this.editEventData.price != null && +this.editEventData.price > 0 ? String(this.editEventData.price) : null,
        description: this.editEventData.description || null,
        contact_email: this.editEventData.contact_email || null,
        ticket_url: this.sanitizeUrl(this.editEventData.ticket_url),
      }).eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo guardar el evento.'); return; }
      this.events.update(evs => evs.map(ev => {
        if (ev.id !== id) return ev;
        return {
          ...ev,
          title: this.editEventData.title,
          venue: this.editEventData.venue,
          city: this.editEventData.city,
          date: this.editEventData.date || ev.date,
          time: this.editEventData.time || ev.time,
          genre: this.editEventData.genre as EventGenre,
          price: this.editEventData.price,
          description: this.editEventData.description || null,
          contact_email: this.editEventData.contact_email || null,
          ticket_url: this.editEventData.ticket_url || null,
        };
      }));
      this.editingEventId.set(null);
      this.focusSoon(`[data-edit-event="${id}"]`);
      this.toast.success('Evento actualizado.');
    } catch {
      this.toast.error('No se pudo guardar el evento.');
    } finally {
      this.editSaving.set(false);
    }
  }

  async deleteEvent(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      const { error } = await this.supabase.client.from('events').delete().eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo eliminar el evento.'); return; }
      this.events.update(evs => evs.filter(ev => ev.id !== id));
      this.toast.success('Evento eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el evento.');
    }
  }

  async deletePost(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    if (!confirm('¿Eliminar este anuncio?')) return;
    try {
      const { error } = await this.supabase.client.from('posts').delete().eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo eliminar el anuncio.'); return; }
      this.myPosts.update(ps => ps.filter(p => p.id !== id));
      this.toast.success('Anuncio eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el anuncio.');
    }
  }

  async deleteListing(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      const { error } = await this.supabase.client.from('gear_listings').delete().eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo eliminar el producto.'); return; }
      this.myListings.update(ls => ls.filter(l => l.id !== id));
      this.toast.success('Producto eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el producto.');
    }
  }

  async markListingSold(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    try {
      const { error } = await this.supabase.client.from('gear_listings').update({ status: 'sold' as const }).eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo marcar como vendido.'); return; }
      this.myListings.update(ls => ls.map(l => l.id === id ? { ...l, status: 'sold' } : l));
      this.toast.success('Marcado como vendido.');
    } catch {
      this.toast.error('No se pudo marcar como vendido.');
    }
  }

  readonly profileLabel = computed(() =>
    ({ musician: 'Músico', band: 'Banda', venue: 'Local', teacher: 'Profesor', rehearsal: 'Ensayo', listener: 'Oyente' } as Record<string, string>)[this.profileType()] ?? ''
  );

  readonly publicProfilePath = computed((): string | null => {
    const id = this.profile()?.id;
    if (!id) return null;
    const seg: Record<string, string> = { musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal' };
    const type = this.profileType();
    return seg[type] ? `/${seg[type]}/${id}` : null;
  });

  async copyProfileLink() {
    const path = this.publicProfilePath();
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      this.toast.error('No se pudo copiar. Cópialo manualmente desde la barra del navegador.');
    }
  }


  readonly postTypeMap: Record<string, { label: string; emoji: string }> = {
    musician_seeking_band: { label: 'Músico busca banda', emoji: '🎸' },
    band_seeking_musician: { label: 'Banda busca músico', emoji: '🥁' },
    event_announcement:    { label: 'Evento',             emoji: '📅' },
    session_offer:         { label: 'Sesión',             emoji: '🎙️' },
    gear_sale:             { label: 'Vendo equipo',        emoji: '🎛️' },
    looking_for_rehearsal: { label: 'Busco local',         emoji: '🏠' },
    collab:                { label: 'Colaboración',        emoji: '🤝' },
    other:                 { label: 'Otro',                emoji: '📢' },
  };

  postInfo(type: string): { label: string; emoji: string } {
    return this.postTypeMap[type] ?? { label: type, emoji: '📢' };
  }

  conditionLabel(c: string) {
    const map: Record<string, string> = { new: 'Nuevo', like_new: 'Como nuevo', good: 'Bueno', acceptable: 'Aceptable' };
    return map[c] ?? c;
  }

  openDeleteConfirm() {
    this.deleteConfirmText.set('');
    this.showDeleteConfirm.set(true);
  }

  cancelDeleteConfirm() {
    this.showDeleteConfirm.set(false);
    this.deleteConfirmText.set('');
  }

  async deleteAccount() {
    if (this.deleteConfirmText().trim().toUpperCase() !== 'BORRAR') return;
    this.deletingAccount.set(true);
    this.showDeleteConfirm.set(false);
    try {
      await this.auth.deleteAccount();
    } catch {
      this.toast.error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      this.deletingAccount.set(false);
    }
  }

  async cancelMyBooking(id: string) {
    const uid = this.auth.user()?.id;
    if (!uid || !confirm('¿Cancelar esta reserva?')) return;
    try {
      const { error } = await this.supabase.client
        .from('rehearsal_bookings').update({ status: 'cancelled' }).eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo cancelar la reserva.'); return; }
      this.myBookings.update(bs => bs.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      this.toast.success('Reserva cancelada.');
    } catch {
      this.toast.error('No se pudo cancelar la reserva.');
    }
  }

  readonly tabNewRoute = computed(() => {
    // routerLink does not parse query strings: '/feed?new=1' became /feed%3Fnew=1 (404).
    const map: Record<string, string> = { events: '/events/create', posts: '/feed', gear: '/shop/new', bookings: '', reservas: '' };
    return map[this.activeTab()] ?? '';
  });

  readonly tabNewQuery = computed(() => (this.activeTab() === 'posts' ? { new: '1' } : null));

  readonly tabNewLabel = computed(() => {
    const map: Record<string, string> = { events: '+ Evento', posts: '+ Anuncio', gear: '+ Vender', bookings: '', reservas: '' };
    return map[this.activeTab()] ?? '';
  });
}
