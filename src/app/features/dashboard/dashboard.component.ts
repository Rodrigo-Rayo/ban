import { Component, inject, signal, OnInit } from '@angular/core';
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
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe, FormsModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  auth          = inject(AuthService);
  private supabase = inject(SupabaseService);
  private seo   = inject(SeoService);
  notifSvc      = inject(NotificationsService);
  messagesService = inject(MessagesService);
  private toast = inject(ToastService);

  profile    = signal<any>(null);
  profileType = signal('');
  events     = signal<any[]>([]);
  myPosts    = signal<any[]>([]);
  myListings = signal<any[]>([]);
  bookings      = signal<any[]>([]);
  myBookings    = signal<any[]>([]);
  sidebarPosts  = signal<any[]>([]);
  sidebarEvents = signal<any[]>([]);
  loading    = signal(true);
  uploadingAvatar = signal(false);
  activeTab  = signal('events');
  linkCopied = signal(false);
  deletingAccount = signal(false);
  editingEventId = signal<string | null>(null);
  editEventData: any = {};
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
        this.supabase.client.from('musicians').select('*').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('bands').select('*').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('venues').select('*').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('teachers').select('*').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('rehearsal_spaces').select('*').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('events').select('*').eq('user_id', uid).order('date', { ascending: false }),
        this.supabase.client.from('posts').select('id, type, text, city, created_at').eq('user_id', uid).order('created_at', { ascending: false }),
        this.supabase.client.from('gear_listings').select('id, title, price, status, condition, category, created_at').eq('user_id', uid).order('created_at', { ascending: false }),
        this.supabase.client.from('posts').select('id, type, text, city, author_name, created_at').order('created_at', { ascending: false }).limit(5),
        this.supabase.client.from('events').select('id, title, venue, city, date, time, genre').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(4),
        this.supabase.client.from('rehearsal_bookings').select('id, date, start_time, end_time, name, status, space_id, rehearsal_spaces(name, city)').eq('user_id', uid).order('date', { ascending: true }),
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
      this.myBookings.set(userBookings || []);

      if (this.profileType() === 'rehearsal' && this.profile()) {
        this.activeTab.set('bookings');
        this.loadBookings(); // fire in background for rehearsal space owners
      }
    } catch {
      this.toast.error('Error al cargar el panel. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadBookings() {
    const { data, error } = await this.supabase.client
      .from('rehearsal_bookings').select('*')
      .eq('space_id', this.profile()!.id)
      .order('date', { ascending: true });
    if (error) { this.toast.error('No se pudieron cargar las reservas.'); return; }
    this.bookings.set(data || []);
  }

  async updateBookingStatus(id: string, status: string) {
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
    if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      this.toast.error('Estado de reserva no válido.');
      return;
    }
    const { error } = await this.supabase.client.from('rehearsal_bookings').update({ status }).eq('id', id);
    if (error) { this.toast.error('No se pudo actualizar el estado de la reserva.'); return; }
    this.bookings.update(bs => bs.map(b => b.id === id ? { ...b, status } : b));
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
          this.profile.update(p => ({ ...p, avatar_url: avatarUrl }));
          this.toast.success('Foto de perfil actualizada.');
        }
      }
    }
    this.uploadingAvatar.set(false);
  }


  startEditEvent(event: any, e: Event) {
    e.preventDefault(); e.stopPropagation();
    this.editingEventId.set(event.id);
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

  cancelEditEvent() { this.editingEventId.set(null); }

  async saveEditEvent(id: string) {
    this.editSaving.set(true);
    const { error } = await this.supabase.client.from('events').update({
      title: this.editEventData.title,
      venue: this.editEventData.venue,
      city: this.editEventData.city,
      date: this.editEventData.date,
      time: this.editEventData.time || null,
      genre: this.editEventData.genre,
      price: this.editEventData.price != null && +this.editEventData.price > 0 ? String(this.editEventData.price) : null,
      description: this.editEventData.description || null,
      contact_email: this.editEventData.contact_email || null,
      ticket_url: this.editEventData.ticket_url || null,
    }).eq('id', id);
    this.editSaving.set(false);
    if (error) { this.toast.error('No se pudo guardar el evento.'); return; }
    this.events.update(evs => evs.map(ev => ev.id === id ? { ...ev, ...this.editEventData } : ev));
    this.editingEventId.set(null);
    this.toast.success('Evento actualizado.');
  }

  async deleteEvent(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este evento?')) return;
    const { error } = await this.supabase.client.from('events').delete().eq('id', id);
    if (error) { this.toast.error('No se pudo eliminar el evento.'); return; }
    this.events.update(evs => evs.filter(ev => ev.id !== id));
    this.toast.success('Evento eliminado.');
  }

  async deletePost(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este anuncio?')) return;
    const { error } = await this.supabase.client.from('posts').delete().eq('id', id);
    if (error) { this.toast.error('No se pudo eliminar el anuncio.'); return; }
    this.myPosts.update(ps => ps.filter(p => p.id !== id));
    this.toast.success('Anuncio eliminado.');
  }

  async deleteListing(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este producto?')) return;
    const { error } = await this.supabase.client.from('gear_listings').delete().eq('id', id);
    if (error) { this.toast.error('No se pudo eliminar el producto.'); return; }
    this.myListings.update(ls => ls.filter(l => l.id !== id));
    this.toast.success('Producto eliminado.');
  }

  async markListingSold(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const { error } = await this.supabase.client.from('gear_listings').update({ status: 'sold' }).eq('id', id);
    if (error) { this.toast.error('No se pudo marcar como vendido.'); return; }
    this.myListings.update(ls => ls.map(l => l.id === id ? { ...l, status: 'sold' } : l));
    this.toast.success('Marcado como vendido.');
  }

  profileLabel() {
    return ({ musician: 'Músico', band: 'Banda', venue: 'Local', teacher: 'Profesor', rehearsal: 'Ensayo', listener: 'Oyente' } as any)[this.profileType()] ?? '';
  }

  publicProfilePath(): string | null {
    const id = this.profile()?.id;
    if (!id) return null;
    const seg: Record<string, string> = { musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal' };
    return seg[this.profileType()] ? `/${seg[this.profileType()]}/${id}` : null;
  }

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
    return ({ new: 'Nuevo', like_new: 'Como nuevo', good: 'Bueno', acceptable: 'Aceptable' } as any)[c] ?? c;
  }

  timeAgo(d: string): string {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  }

  async deleteAccount() {
    const confirmed = prompt('Escribe BORRAR para confirmar. Esta acción es irreversible y eliminará todos tus datos.');
    if (confirmed?.trim().toUpperCase() !== 'BORRAR') return;
    this.deletingAccount.set(true);
    try {
      const { error } = await this.supabase.client.rpc('delete_user_account');
      if (error) {
        this.toast.error('No se pudo eliminar la cuenta. Contacta con soporte.');
        this.deletingAccount.set(false);
        return;
      }
      await this.auth.signOut();
    } catch {
      this.toast.error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      this.deletingAccount.set(false);
    }
  }

  async cancelMyBooking(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    const { error } = await this.supabase.client
      .from('rehearsal_bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) { this.toast.error('No se pudo cancelar la reserva.'); return; }
    this.myBookings.update(bs => bs.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    this.toast.success('Reserva cancelada.');
  }

  get tabNewRoute() {
    const map: Record<string, string> = { events: '/events/create', posts: '/feed?new=1', gear: '/shop/new', bookings: '', reservas: '' };
    return map[this.activeTab()] ?? '';
  }

  get tabNewLabel() {
    const map: Record<string, string> = { events: '+ Evento', posts: '+ Anuncio', gear: '+ Vender', bookings: '', reservas: '' };
    return map[this.activeTab()] ?? '';
  }
}
