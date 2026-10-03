import { Component, ElementRef, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SeoService } from '../../core/services/seo.service';
import { CITIES } from '../../core/constants/cities';
import { timeAgo } from '../../core/utils/display.utils';
import { dateParts, formatTime } from '../../core/utils/date';
import { askLabel as askLabelFor, askStampClass as askStampClassFor } from '../../core/utils/se-busca';
import { AvatarUploadComponent } from '../../shared/components/avatar-upload/avatar-upload.component';
import { Event as AppEvent, EventGenre, PostType } from '../../core/models';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { MediaUploadService, MEDIA_ACCEPT, mediaFileError } from '../../core/services/media-upload.service';

interface DashboardProfile {
  id?: string;
  user_id?: string;
  name: string;
  city?: string | null;
  avatar_url?: string | null;
}

interface DashboardPost {
  id: string;
  type: PostType;
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

export type DashboardTab = 'events' | 'posts' | 'gear';

@Component({
    selector: 'app-dashboard',
    imports: [RouterLink, DecimalPipe, FormsModule, AvatarUploadComponent],
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly timeAgo = timeAgo;
  readonly askLabel = (type: string) => askLabelFor(type as PostType);
  readonly askStampClass = (type: string) => askStampClassFor(type as PostType);
  readonly eventDate = dateParts;
  readonly eventTime = formatTime;

  auth          = inject(AuthService);
  private supabase = inject(SupabaseService);
  private seo   = inject(SeoService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private features = inject(MediaFeaturesService);
  private media = inject(MediaUploadService);

  profile    = signal<DashboardProfile | null>(null);
  profileType = signal('');
  events     = signal<AppEvent[]>([]);
  myPosts    = signal<DashboardPost[]>([]);
  myListings = signal<DashboardListing[]>([]);
  loading    = signal(true);
  activeTab  = signal<DashboardTab>('events');
  linkCopied = signal(false);
  /** Inline event edit: title left empty on save attempt. */
  editTitleError = signal(false);
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
  /** Poster editing appears only once events.image_url exists. */
  readonly canEditPoster = this.features.state('eventImage');
  readonly posterAccept = MEDIA_ACCEPT;
  /** Poster stored on the event being edited. */
  editPosterCurrent = signal<string | null>(null);
  /** New poster picked in the inline editor (uploaded on save). */
  editPosterFile = signal<File | null>(null);
  editPosterPreview = signal<string | null>(null);
  editPosterRemoved = signal(false);
  editPosterError = signal('');
  readonly editPosterShown = computed(() =>
    this.editPosterPreview() ?? (this.editPosterRemoved() ? null : this.editPosterCurrent()));
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Otro'];
  readonly cities = CITIES;

  async ngOnInit() {
    this.seo.set({ title: 'Mi panel' });
    void this.features.has('eventImage');
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [
        { data: musician, error: e1 }, { data: band, error: e2 }, { data: venue, error: e3 },
        { data: teacher, error: e4 }, { data: rehearsal, error: e5 }, { data: evs },
        { data: posts },   { data: listings },
        { data: profileRow },
      ] = await Promise.all([
        this.supabase.client.from('musicians').select('id,name,city,avatar_url,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('bands').select('id,name,city,avatar_url,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('venues').select('id,name,city,avatar_url,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('teachers').select('id,name,city,avatar_url,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('rehearsal_spaces').select('id,name,city,avatar_url,user_id').eq('user_id', uid).maybeSingle(),
        this.supabase.client.from('events').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(50),
        this.supabase.client.from('posts').select('id, type, text, city, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
        this.supabase.client.from('gear_listings').select('id, title, price, status, images, condition, category, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
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
      this.myPosts.set((posts || []) as DashboardPost[]);
      this.myListings.set(listings || []);
    } catch {
      this.toast.error('Error al cargar el panel. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  /** <app-avatar-upload> already saved the photo; just reflect it here. */
  onAvatarUploaded(url: string) {
    this.profile.update(p => p ? { ...p, avatar_url: url } : p);
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
    this.resetEditPoster(event.image_url ?? null);
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

  onEditPosterChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const invalid = mediaFileError(file);
    if (invalid) { this.editPosterError.set(invalid); return; }
    this.editPosterError.set('');
    this.setEditPosterFile(file);
  }

  removeEditPoster() {
    this.editPosterError.set('');
    this.setEditPosterFile(null);
    this.editPosterRemoved.set(true);
  }

  private setEditPosterFile(file: File | null) {
    const old = this.editPosterPreview();
    if (old) URL.revokeObjectURL(old);
    this.editPosterFile.set(file);
    this.editPosterPreview.set(file ? URL.createObjectURL(file) : null);
    if (file) this.editPosterRemoved.set(false);
  }

  private resetEditPoster(current: string | null) {
    this.setEditPosterFile(null);
    this.editPosterCurrent.set(current);
    this.editPosterRemoved.set(false);
    this.editPosterError.set('');
  }

  /**
   * image_url patch for the save: {} when unchanged or the column does not exist,
   * null when the upload failed (already toasted).
   */
  private async editPosterPatch(): Promise<{ image_url?: string | null } | null> {
    if (!this.canEditPoster()) return {};
    const file = this.editPosterFile();
    if (file) {
      const url = await this.media.upload(file, 'events');
      return url ? { image_url: url } : null;
    }
    return this.editPosterRemoved() && this.editPosterCurrent() ? { image_url: null } : {};
  }

  ngOnDestroy() {
    const url = this.editPosterPreview();
    if (url) URL.revokeObjectURL(url);
  }

  cancelEditEvent() {
    const id = this.editingEventId();
    this.editingEventId.set(null);
    this.resetEditPoster(null);
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
      const posterPatch = await this.editPosterPatch();
      if (!posterPatch) return;
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
        ...posterPatch,
      }).eq('id', id).eq('user_id', uid);
      if (error) {
        if (posterPatch.image_url) void this.media.remove(posterPatch.image_url);
        this.toast.error('No se pudo guardar el evento.');
        return;
      }
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
          ...posterPatch,
        };
      }));
      const replaced = this.editPosterCurrent();
      if (replaced && 'image_url' in posterPatch) void this.media.remove(replaced);
      this.editingEventId.set(null);
      this.resetEditPoster(null);
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
    if (!(await this.confirm.ask({
      title: '¿Eliminar este evento?',
      message: 'Dejará de aparecer en la Agenda. No se puede deshacer.',
      confirmLabel: 'Eliminar', danger: true,
    }))) return;
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
    if (!(await this.confirm.ask({
      title: '¿Eliminar este anuncio?',
      message: 'Dejará de aparecer en Se busca. No se puede deshacer.',
      confirmLabel: 'Eliminar', danger: true,
    }))) return;
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
    if (!(await this.confirm.ask({
      title: '¿Eliminar este artículo?',
      message: 'Dejará de aparecer en la Tienda. No se puede deshacer.',
      confirmLabel: 'Eliminar', danger: true,
    }))) return;
    try {
      const { error } = await this.supabase.client.from('gear_listings').delete().eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error('No se pudo eliminar el artículo.'); return; }
      this.myListings.update(ls => ls.filter(l => l.id !== id));
      this.toast.success('Artículo eliminado.');
    } catch {
      this.toast.error('No se pudo eliminar el artículo.');
    }
  }

  async markListingSold(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    if (!(await this.confirm.ask({
      title: '¿Marcar como vendido?',
      message: 'Dejará de aparecer en la Tienda. Podrás volver a ponerlo en venta.',
      confirmLabel: 'Marcar como vendido',
    }))) return;
    await this.setListingStatus(id, uid, 'sold', 'Marcado como vendido.', 'No se pudo marcar como vendido.');
  }

  async relistListing(id: string, e: Event) {
    e.preventDefault(); e.stopPropagation();
    const uid = this.auth.user()?.id;
    if (!uid) return;
    await this.setListingStatus(id, uid, 'active', 'Artículo de nuevo en venta.', 'No se pudo volver a poner en venta.');
  }

  private async setListingStatus(id: string, uid: string, status: 'sold' | 'active', okMsg: string, errMsg: string) {
    try {
      const { error } = await this.supabase.client.from('gear_listings').update({ status }).eq('id', id).eq('user_id', uid);
      if (error) { this.toast.error(errMsg); return; }
      this.myListings.update(ls => ls.map(l => l.id === id ? { ...l, status } : l));
      this.toast.success(okMsg);
    } catch {
      this.toast.error(errMsg);
    }
  }

  readonly profileLabel = computed(() =>
    ({ musician: 'Músico', band: 'Banda', venue: 'Sala', teacher: 'Profesor', rehearsal: 'Local', listener: 'Oyente' } as Record<string, string>)[this.profileType()] ?? ''
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
    if (this.deleteConfirmText().trim().toUpperCase() !== 'ELIMINAR') return;
    this.deletingAccount.set(true);
    this.showDeleteConfirm.set(false);
    try {
      await this.auth.deleteAccount();
    } catch {
      this.toast.error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      this.deletingAccount.set(false);
    }
  }

  /** One tab bar; each tab carries its own count. */
  readonly tabs = computed((): { id: DashboardTab; label: string; count: number }[] => [
    { id: 'events', label: 'Agenda',   count: this.events().length },
    { id: 'posts',  label: 'Se busca', count: this.myPosts().length },
    { id: 'gear',   label: 'Tienda',   count: this.myListings().length },
  ]);

  readonly activeCount = computed(() => this.tabs().find(t => t.id === this.activeTab())?.count ?? 0);

  readonly tabNewRoute = computed(() => {
    // routerLink does not parse query strings: '/feed?new=1' became /feed%3Fnew=1 (404).
    const map: Record<DashboardTab, string> = { events: '/events/create', posts: '/feed', gear: '/shop/new' };
    return map[this.activeTab()];
  });

  readonly tabNewQuery = computed(() => (this.activeTab() === 'posts' ? { new: '1' } : null));

  readonly tabNewLabel = computed(() => {
    const map: Record<DashboardTab, string> = { events: 'Publicar evento', posts: 'Publicar anuncio', gear: 'Publicar artículo' };
    return map[this.activeTab()];
  });
}
