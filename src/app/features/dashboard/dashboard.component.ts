import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificationsService } from '../../core/services/notifications.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, DatePipe, FormsModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  auth       = inject(AuthService);
  private supabase = inject(SupabaseService);
  notifSvc   = inject(NotificationsService);

  profile    = signal<any>(null);
  profileType = signal('');
  events     = signal<any[]>([]);
  myPosts    = signal<any[]>([]);
  myListings = signal<any[]>([]);
  bookings      = signal<any[]>([]);
  sidebarPosts  = signal<any[]>([]);
  sidebarEvents = signal<any[]>([]);
  loading    = signal(true);
  uploadingAvatar = signal(false);
  activeTab  = signal('events');
  linkCopied = signal(false);

  async ngOnInit() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    const [
      { data: musician }, { data: band }, { data: venue },
      { data: teacher }, { data: rehearsal }, { data: evs },
      { data: posts },   { data: listings },
      { data: sbPosts }, { data: sbEvents },
    ] = await Promise.all([
      this.supabase.client.from('musicians').select('*').eq('user_id', uid).maybeSingle(),
      this.supabase.client.from('bands').select('*').eq('user_id', uid).maybeSingle(),
      this.supabase.client.from('venues').select('*').eq('user_id', uid).maybeSingle(),
      this.supabase.client.from('teachers').select('*').eq('user_id', uid).maybeSingle(),
      this.supabase.client.from('rehearsal_spaces').select('*').eq('user_id', uid).maybeSingle(),
      this.supabase.client.from('events').select('*').eq('user_id', uid).order('date', { ascending: false }),
      this.supabase.client.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      this.supabase.client.from('gear_listings').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      this.supabase.client.from('posts').select('*').order('created_at', { ascending: false }).limit(5),
      this.supabase.client.from('events').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(4),
    ]);

    if (musician)       { this.profile.set(musician);  this.profileType.set('musician'); }
    else if (band)      { this.profile.set(band);       this.profileType.set('band'); }
    else if (venue)     { this.profile.set(venue);      this.profileType.set('venue'); }
    else if (teacher)   { this.profile.set(teacher);    this.profileType.set('teacher'); }
    else if (rehearsal) { this.profile.set(rehearsal);  this.profileType.set('rehearsal'); }

    this.events.set(evs || []);
    this.myPosts.set(posts || []);
    this.myListings.set(listings || []);
    this.sidebarPosts.set(sbPosts || []);
    this.sidebarEvents.set(sbEvents || []);

    if (this.profileType() === 'rehearsal' && this.profile()) {
      this.activeTab.set('bookings');
      await this.loadBookings();
    }

    this.loading.set(false);
  }

  async loadBookings() {
    const { data } = await this.supabase.client
      .from('rehearsal_bookings').select('*')
      .eq('space_id', this.profile()!.id)
      .order('date', { ascending: true });
    this.bookings.set(data || []);
  }

  async updateBookingStatus(id: string, status: string) {
    await this.supabase.client.from('rehearsal_bookings').update({ status }).eq('id', id);
    this.bookings.update(bs => bs.map(b => b.id === id ? { ...b, status } : b));
  }

  async uploadAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;
    this.uploadingAvatar.set(true);
    const path = `${session.user.id}/avatar.${file.name.split('.').pop()}`;
    const { error } = await this.supabase.client.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = this.supabase.client.storage.from('avatars').getPublicUrl(path);
      const table: Record<string, string> = { musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal_spaces' };
      if (table[this.profileType()]) {
        await this.supabase.client.from(table[this.profileType()]).update({ avatar_url: urlData.publicUrl }).eq('user_id', session.user.id);
        this.profile.update(p => ({ ...p, avatar_url: urlData.publicUrl }));
      }
    }
    this.uploadingAvatar.set(false);
  }

  async toggleAvailability() {
    const p = this.profile();
    if (!p || this.profileType() !== 'musician') return;
    await this.supabase.client.from('musicians').update({ available: !p.available }).eq('user_id', p.user_id);
    this.profile.update(p => ({ ...p, available: !p.available }));
  }

  async deleteEvent(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este evento?')) return;
    await this.supabase.client.from('events').delete().eq('id', id);
    this.events.update(evs => evs.filter(ev => ev.id !== id));
  }

  async deletePost(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este anuncio?')) return;
    await this.supabase.client.from('posts').delete().eq('id', id);
    this.myPosts.update(ps => ps.filter(p => p.id !== id));
  }

  async deleteListing(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar este producto?')) return;
    await this.supabase.client.from('gear_listings').delete().eq('id', id);
    this.myListings.update(ls => ls.filter(l => l.id !== id));
  }

  async markListingSold(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    await this.supabase.client.from('gear_listings').update({ status: 'sold' }).eq('id', id);
    this.myListings.update(ls => ls.map(l => l.id === id ? { ...l, status: 'sold' } : l));
  }

  profileLabel() {
    return ({ musician: 'Músico', band: 'Banda', venue: 'Local', teacher: 'Profesor', rehearsal: 'Ensayo' } as any)[this.profileType()] ?? '';
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
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
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

  get tabNewRoute() {
    return { events: '/events/create', posts: '/feed', gear: '/shop/new', bookings: '' }[this.activeTab()] ?? '';
  }

  get tabNewLabel() {
    return { events: '+ Evento', posts: '+ Anuncio', gear: '+ Vender', bookings: '' }[this.activeTab()] ?? '';
  }
}
