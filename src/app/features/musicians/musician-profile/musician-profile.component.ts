import { ReportLinkComponent } from '../../../shared/components/report-link/report-link.component';
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../../shared/components/avatar-upload/avatar-upload.component';
import { avatarColor } from '../../../core/utils/display.utils';
import { parseList } from '../../../core/utils/list';
import { joinWeekdays } from '../../../core/utils/weekdays';

export { joinWeekdays };
import { Musician } from '../../../core/models';

/** Columns rendered by the profile page (avoid select('*')). */
const MUSICIAN_COLUMNS = 'id, user_id, name, instrument, genre, city, description, avatar_url, experience, influences, availability_days, availability_slots, instagram_url, soundcloud_url, spotify_url, website_url, youtube_url';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-musician-profile',
    imports: [ReportLinkComponent, RouterLink, IconComponent, AvatarUploadComponent],
    templateUrl: './musician-profile.component.html'
})
export class MusicianProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);

  musician = signal<Musician | null>(null);
  availabilityDays = computed(() => parseList(this.musician()?.availability_days));
  availabilitySlots = computed(() => parseList(this.musician()?.availability_slots));
  /** "Lunes y jueves": only the listed weekdays, in week order, as plain text. */
  availableDaysText = computed(() => joinWeekdays(this.availabilityDays()));
  posterLine = computed(() => [this.musician()?.instrument, this.musician()?.city].filter(Boolean).join(' · '));
  hasLinks = computed(() => {
    const m = this.musician();
    return !!(m && (m.spotify_url || m.youtube_url || m.soundcloud_url || m.instagram_url || m.website_url));
  });
  loading = signal(true);
  isFav = signal(false);
  avatarError = signal(false);
  currentUserId = signal<string | null>(null);
  favLoading = signal(false);
  sending = signal(false);
  msgError = signal<string | null>(null);
  linkShared = signal(false);

  /** Signed-in user owns this profile. */
  readonly isOwner = computed(() => {
    const uid = this.currentUserId();
    const owner = this.musician()?.user_id;
    return !!uid && !!owner && uid === owner;
  });
  /** Can write to the owner: someone else's profile that has an account behind it. */
  readonly canMessage = computed(() => !this.isOwner() && !!this.musician()?.user_id);

  onPhotoUploaded(url: string) {
    this.musician.update(v => (v ? { ...v, avatar_url: url } : v));
    this.avatarError.set(false);
  }

  /** Logged-out visitors go to login and come back to this profile afterwards. */
  goToLogin() {
    try { sessionStorage.setItem('bandyou_return_url', window.location.pathname); } catch { /* storage blocked */ }
    this.router.navigate(['/auth/login']);
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    try {
      const [{ data }, { data: { session } }] = await Promise.all([
        this.supabase.client.from('musicians').select(MUSICIAN_COLUMNS).eq('id', id).maybeSingle(),
        this.supabase.auth.getSession(),
      ]);
      this.musician.set(data as Musician | null);
      if (data) {
        this.seo.setProfile(data.name, 'musician', data.city, data.description, data.avatar_url, undefined, data.instrument);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: data.name,
          description: data.description || '',
          image: data.avatar_url || '',
          url: `https://www.bandyou.es/musicians/${data.id}`,
          address: { '@type': 'PostalAddress', addressLocality: data.city || '', addressCountry: 'ES' },
        });
      } else {
        this.seo.setNotFound();
      }
      if (session) {
        this.currentUserId.set(session.user.id);
        // isFav runs in background — doesn't block UI
        this.favSvc.isFavorite(session.user.id, 'musician', id).then(v => this.isFav.set(v)).catch(() => { /* non-critical background check */ });
      }
    } catch {
      // Profile not found: musician() stays null and the template shows the empty state.
      // If it was a real network error, inform the user.
      this.toast.error('No se pudo cargar el perfil. Recarga la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    this.favLoading.set(true);
    try {
      const musician = this.musician();
      if (!musician) return;
      const result = await this.favSvc.toggle(this.currentUserId()!, 'musician', musician.id);
      this.isFav.set(result);
    } catch {
      this.toast.error('No se pudo actualizar favoritos. Inténtalo de nuevo.');
    } finally {
      this.favLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    const musician = this.musician();
    if (!uid) { this.goToLogin(); return; }
    if (!musician) return;
    if (uid === musician.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    try {
      const result = await this.messagesService.getOrCreateConversation(musician.user_id, musician.name);
      if (!result) return;
      if ('error' in result) { this.msgError.set(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: musician.name } });
    } catch {
      this.msgError.set('No se pudo abrir la conversación.');
    } finally {
      this.sending.set(false);
    }
  }

  async shareLink() {
    const musician = this.musician();
    if (!musician) return;
    const url = `${window.location.origin}/musicians/${musician.id}`;
    if (navigator.share) {
      await navigator.share({ title: musician.name, url }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(url);
        this.linkShared.set(true);
        setTimeout(() => this.linkShared.set(false), 2000);
      } catch {
        this.toast.error('No se pudo copiar el enlace.');
      }
    }
  }

}
