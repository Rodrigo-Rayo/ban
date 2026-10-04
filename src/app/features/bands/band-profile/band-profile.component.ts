import { ReportLinkComponent } from '../../../shared/components/report-link/report-link.component';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { MessagesService } from '../../../core/services/messages.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AvatarUploadComponent } from '../../../shared/components/avatar-upload/avatar-upload.component';
import { ConfirmService } from '../../../core/services/confirm.service';
import { avatarColor } from '../../../core/utils/display.utils';
import { parseList } from '../../../core/utils/list';
import { joinWeekdays } from '../../../core/utils/weekdays';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { GENRES, INSTRUMENTS } from '../../../core/constants/music.constants';
import {
  applicationNoticeBody, applicationReviewedBody, applicationReviewedTitle, vacancyClosedTitle, VACANCY_CLOSED_BODY,
} from './application-notice';
import { Band, BandVacancy, BandMember } from '../../../core/models';
import { environment } from '../../../../environments/environment';

interface VacancyApplication {
  id: string;
  vacancy_id: string;
  musician_id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  band_vacancies: { instrument: string } | null;
  musician: { id: string; name: string; city: string; genre: string | null; avatar_url: string | null } | null;
}

const BAND_COLUMNS = 'id, user_id, name, genre, city, description, avatar_url, looking_for, instagram_url, soundcloud_url, spotify_url, website_url, youtube_url';
/** Only named once the columns exist (MediaFeaturesService 'bandAvailability'). */
const BAND_AVAILABILITY_COLUMNS = ', rehearsal_days, rehearsal_slots, open_to_gigs';
const MAX_VACANCIES = 50;
const MAX_MEMBERS = 50;

@Component({
    selector: 'app-band-profile',
    imports: [ReportLinkComponent, RouterLink, FormsModule, IconComponent, AvatarUploadComponent],
    templateUrl: './band-profile.component.html'
})
export class BandProfileComponent implements OnInit {
  readonly avatarColor = avatarColor;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private seo = inject(SeoService);
  private favSvc = inject(FavoritesService);
  private notifSvc = inject(NotificationsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  private features = inject(MediaFeaturesService);
  band = signal<Band | null>(null);
  vacancies = signal<BandVacancy[]>([]);
  members = signal<BandMember[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  myMusicianId = signal<string | null>(null);
  myMusicianUserId = signal<string | null>(null);
  myMusicianName = signal<string | null>(null);
  deletingVacancy = signal<string | null>(null);
  appliedVacancies = signal<string[]>([]);
  isFav = signal(false);
  favLoading = signal(false);
  avatarError = signal(false);

  linkShared = signal(false);
  applyingTo = signal<string | null>(null);
  applyMessage = '';
  applyLoading = signal(false);
  applySuccess = signal<string | null>(null);
  sending = signal(false);
  msgError = signal<string | null>(null);

  showVacancyForm = signal(false);
  vacancyLoading = signal(false);
  newVacancy = { instrument: '', description: '', genre: '' };
  readonly instruments = INSTRUMENTS;
  readonly genres = GENRES;

  applications = signal<VacancyApplication[]>([]);
  applicationsLoading = signal(false);

  /** Signed-in user owns this profile. */
  readonly isOwner = computed(() => {
    const uid = this.currentUserId();
    const owner = this.band()?.user_id;
    return !!uid && !!owner && uid === owner;
  });
  /** Can write to the owner: someone else's profile that has an account behind it. */
  readonly canMessage = computed(() => !this.isOwner() && !!this.band()?.user_id);

  onPhotoUploaded(url: string) {
    this.band.update(v => (v ? { ...v, avatar_url: url } : v));
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
      const columns = BAND_COLUMNS + (await this.features.has('bandAvailability') ? BAND_AVAILABILITY_COLUMNS : '');
      // Round 1: all 4 independent queries in parallel
      const [
        { data: bandRow },
        { data: { session } },
        { data: vac },
        { data: membersData },
      ] = await Promise.all([
        this.supabase.client.from('bands').select(columns).eq('id', id).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('band_vacancies').select('id, band_id, instrument, description, genre, open, created_at').eq('band_id', id).order('created_at').limit(MAX_VACANCIES),
        this.supabase.client.from('band_members').select('id, band_id, name, instrument, created_at').eq('band_id', id).order('created_at').limit(MAX_MEMBERS),
      ]);

      // The column list is dynamic, so the row type is given here.
      const band = bandRow as unknown as Band | null;
      this.band.set(band);
      if (band) {
        this.seo.setProfile(band.name, 'band', band.city, band.description, band.avatar_url ?? undefined);
        this.seo.injectJsonLd({
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: band.name,
          description: band.description || '',
          image: band.avatar_url || '',
          url: `${window.location.origin}/bands/${band.id}`,
          genre: band.genre || '',
          address: { '@type': 'PostalAddress', addressLocality: band.city || '', addressCountry: 'ES' },
        });
      } else {
        this.seo.setNotFound();
      }
      this.vacancies.set(vac || []);
      this.members.set(membersData || []);
      this.loading.set(false);

      if (!session) return;
      this.currentUserId.set(session.user.id);

      // Round 2: musician lookup and isFav in parallel
      const [{ data: musician }] = await Promise.all([
        this.supabase.client.from('musicians').select('id, user_id, name').eq('user_id', session.user.id).maybeSingle(),
        band ? this.favSvc.isFavorite(session.user.id, 'band', band.id).then(v => this.isFav.set(v)) : Promise.resolve(),
      ]);

      if (musician) {
        this.myMusicianId.set(musician.id);
        this.myMusicianUserId.set(musician.user_id);
        this.myMusicianName.set(musician.name ?? null);
        const { data: apps } = await this.supabase.client
          .from('vacancy_applications').select('vacancy_id').eq('musician_id', musician.id);
        this.appliedVacancies.set((apps || []).map(a => a.vacancy_id));
      }

      if (band && session.user.id === band.user_id) {
        this.loadApplications().catch(err => {
          if (!environment.production) console.error('[BandProfile] loadApplications failed:', err);
          this.toast.error('No se pudieron cargar los interesados.');
        });
      }
    } catch {
      this.toast.error('No se pudo cargar el perfil de la banda. Inténtalo de nuevo.');
      this.loading.set(false);
    }
  }

  /** "Ensayamos: Martes y jueves" + franjas, and whether the band takes gigs. */
  readonly rehearsalDaysText = computed(() => joinWeekdays(parseList(this.band()?.rehearsal_days)));
  readonly rehearsalSlots = computed(() => parseList(this.band()?.rehearsal_slots));
  readonly openToGigs = computed(() => !!this.band()?.open_to_gigs);
  readonly hasAvailability = computed(() => this.openToGigs() || !!this.rehearsalDaysText() || this.rehearsalSlots().length > 0);

  readonly posterLine = computed(() => [this.band()?.genre, this.band()?.city].filter(Boolean).join(' · '));
  readonly hasLinks = computed(() => {
    const b = this.band();
    return !!(b && (b.spotify_url || b.youtube_url || b.soundcloud_url || b.instagram_url || b.website_url));
  });
  readonly openVacancies = computed(() => this.vacancies().filter(v => v.open));
  readonly closedVacancies = computed(() => this.vacancies().filter(v => !v.open));

  async createVacancy() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    if (!this.band() || !this.newVacancy.instrument) return;
    this.vacancyLoading.set(true);
    const { data, error } = await this.supabase.client.from('band_vacancies').insert({
      band_id: this.band()!.id,
      instrument: this.newVacancy.instrument,
      description: this.newVacancy.description,
      genre: this.newVacancy.genre,
      open: true,
    }).select().single();
    this.vacancyLoading.set(false);
    if (error) { this.toast.error('No se pudo publicar la vacante.'); return; }
    if (data) {
      this.vacancies.update(v => [...v, data]);
      this.newVacancy = { instrument: '', description: '', genre: '' };
      this.showVacancyForm.set(false);
      this.toast.success('Vacante publicada.');
    }
  }

  async loadApplications() {
    this.applicationsLoading.set(true);
    try {
      const vacancyIds = this.vacancies().map(v => v.id);
      if (vacancyIds.length === 0) return;
      const { data: apps, error } = await this.supabase.client
        .from('vacancy_applications')
        // No embed: the band_vacancies relationship is not guaranteed in the live
        // schema; the instrument is resolved from the vacancies already loaded.
        .select('*')
        .in('vacancy_id', vacancyIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) { this.toast.error('No se pudieron cargar los interesados.'); return; }
      const musicianIds = [...new Set((apps || []).map(a => a.musician_id).filter(Boolean))] as string[];
      const { data: musicians } = musicianIds.length
        ? await this.supabase.client.from('musicians').select('id, name, city, genre, avatar_url').in('id', musicianIds)
        : { data: [] };
      const musicianMap = new Map((musicians || []).map(m => [m.id, m]));
      const instrumentById = new Map(this.vacancies().map(v => [v.id, v.instrument]));
      this.applications.set((apps || []).map(app => ({
        ...app,
        musician: musicianMap.get(app.musician_id) ?? null,
        band_vacancies: { instrument: instrumentById.get(app.vacancy_id) ?? '' },
      })) as VacancyApplication[]);
    } finally {
      this.applicationsLoading.set(false);
    }
  }

  async closeVacancy(id: string) {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    const ok = await this.confirm.ask({
      title: '¿Cerrar esta vacante?',
      message: 'Dejará de aparecer en Se busca. Podrás reabrirla cuando quieras.',
      confirmLabel: 'Cerrar vacante',
    });
    if (!ok) return;
    try {
      const { error } = await this.supabase.client.from('band_vacancies').update({ open: false }).eq('id', id);
      if (error) { this.toast.error('No se pudo cerrar la vacante.'); return; }
      this.vacancies.update(v => v.map(x => x.id === id ? { ...x, open: false } : x));
      this.notifyVacancyClosed(id);
    } catch {
      this.toast.error('No se pudo cerrar la vacante.');
    }
  }

  /** Best effort: tells everyone who applied that the vacancy closed (one notice per person). */
  private notifyVacancyClosed(vacancyId: string) {
    const band = this.band();
    const vacancy = this.vacancies().find(v => v.id === vacancyId);
    if (!band || !vacancy) return;
    const me = this.currentUserId();
    const recipients = new Set(this.applications()
      .filter(a => a.vacancy_id === vacancyId && !!a.user_id && a.user_id !== me)
      .map(a => a.user_id));
    const title = vacancyClosedTitle(band.name, vacancy.instrument);
    recipients.forEach(userId =>
      this.notifSvc.create(userId, 'application', title, VACANCY_CLOSED_BODY, 'band', band.id).catch(() => undefined));
  }

  /** Deletes a closed vacancy (and, by cascade, its applications). RLS: band owner has ALL on band_vacancies. */
  async deleteVacancy(vacancy: BandVacancy) {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    const ok = await this.confirm.ask({
      title: `¿Eliminar la vacante de ${vacancy.instrument}?`,
      message: 'Se borra para siempre, junto con los interesados que haya recibido.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deletingVacancy.set(vacancy.id);
    try {
      // .select() returns the deleted rows: RLS can silently delete nothing without an error.
      const { data, error } = await this.supabase.client.from('band_vacancies').delete().eq('id', vacancy.id).select('id');
      if (error) {
        const blocked = error.code === '23503' || (error as { status?: number }).status === 409;
        this.toast.error(blocked
          ? 'No se puede eliminar mientras tenga interesados. Ciérrala para que no lleguen más.'
          : 'No se pudo eliminar la vacante.');
        return;
      }
      if (!data || data.length === 0) {
        this.toast.error('No se pudo eliminar la vacante.');
        return;
      }
      this.vacancies.update(v => v.filter(x => x.id !== vacancy.id));
      this.applications.update(a => a.filter(x => x.vacancy_id !== vacancy.id));
      this.toast.success('Vacante eliminada.');
    } catch {
      this.toast.error('No se pudo eliminar la vacante.');
    } finally {
      this.deletingVacancy.set(null);
    }
  }

  async reopenVacancy(id: string) {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    try {
      const { error } = await this.supabase.client.from('band_vacancies').update({ open: true }).eq('id', id);
      if (error) { this.toast.error('No se pudo reabrir la vacante.'); return; }
      this.vacancies.update(v => v.map(x => x.id === id ? { ...x, open: true } : x));
    } catch {
      this.toast.error('No se pudo reabrir la vacante.');
    }
  }

  hasApplied(vacancyId: string) {
    return this.appliedVacancies().includes(vacancyId);
  }

  openApply(vacancyId: string) {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    if (this.currentUserId() === this.band()?.user_id) {
      this.toast.error('No puedes apuntarte a las vacantes de tu propia banda.');
      return;
    }
    if (!this.myMusicianId()) {
      this.toast.error('Solo los músicos pueden mostrar interés. Crea tu perfil de músico en tu panel.');
      return;
    }
    // Remember the trigger so focus can return to it when the dialog closes (WCAG 2.4.3).
    this.applyReturnFocus = document.activeElement as HTMLElement | null;
    this.applyingTo.set(vacancyId);
    this.applyMessage = '';
    setTimeout(() => document.getElementById('apply-message')?.focus());
  }

  private applyReturnFocus: HTMLElement | null = null;

  closeApply() {
    this.applyingTo.set(null);
    const trigger = this.applyReturnFocus;
    this.applyReturnFocus = null;
    if (trigger?.isConnected) setTimeout(() => trigger.focus());
  }

  /** Submit from the dialog, then hand focus back once it has closed. */
  async submitApplyFromDialog() {
    const trigger = this.applyReturnFocus;
    await this.submitApply();
    if (!this.applyingTo()) {
      this.applyReturnFocus = null;
      // The "Me interesa" button is replaced by a status tag on success; only refocus if it still exists.
      if (trigger?.isConnected) trigger.focus();
    }
  }

  /** Escape closes; Tab / Shift+Tab cycle within the dialog (focus trap without @angular/cdk). */
  onApplyKeydown(e: KeyboardEvent, dialog: HTMLElement) {
    if (e.key === 'Escape') { e.preventDefault(); this.closeApply(); return; }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ));
    if (focusables.length === 0) { e.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  async submitApply() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    const vacancyId = this.applyingTo();
    if (!vacancyId || !this.myMusicianId()) return;
    this.applyLoading.set(true);
    try {
      const { error } = await this.supabase.client.from('vacancy_applications').insert({
        vacancy_id: vacancyId,
        musician_id: this.myMusicianId(),
        user_id: this.currentUserId(),
        message: this.applyMessage,
      });
      if (error) {
        this.toast.error('No se pudo enviar. Inténtalo de nuevo.');
        return;
      }
      this.appliedVacancies.update(arr => [...arr, vacancyId]);
      this.applySuccess.set(vacancyId);
      this.applyingTo.set(null);
      setTimeout(() => this.applySuccess.set(null), 3000);
      if (this.band()?.user_id) {
        const vacancy = this.vacancies().find(v => v.id === vacancyId);
        // Best effort: the application is already saved — a notification failure
        // (e.g. rate limit) must not report the whole action as failed.
        this.notifSvc.create(
          this.band()!.user_id, 'application',
          'Alguien quiere tocar en tu banda',
          applicationNoticeBody(this.myMusicianName(), vacancy?.instrument),
          'band', this.band()!.id
        ).catch(() => undefined);
      }
    } catch {
      this.toast.error('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      this.applyLoading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.goToLogin(); return; }
    this.favLoading.set(true);
    try {
      const result = await this.favSvc.toggle(this.currentUserId()!, 'band', this.band()!.id);
      this.isFav.set(result);
    } catch {
      this.toast.error('No se pudo actualizar favoritos. Inténtalo de nuevo.');
    } finally {
      this.favLoading.set(false);
    }
  }

  async sendMessage() {
    const uid = this.currentUserId();
    const band = this.band();
    if (!uid) { this.goToLogin(); return; }
    if (!band) return;
    if (uid === band.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    try {
      const result = await this.messagesService.getOrCreateConversation(band.user_id, band.name);
      if (!result) return;
      if ('error' in result) { this.msgError.set(result.error); return; }
      this.router.navigate(['/inbox', result.id], { state: { name: band.name } });
    } catch {
      this.msgError.set('No se pudo abrir la conversación.');
    } finally {
      this.sending.set(false);
    }
  }

  contactingApp = signal<string | null>(null);

  async contactApplicant(app: VacancyApplication) {
    const uid = this.currentUserId();
    if (!uid || !app.user_id) return;
    this.contactingApp.set(app.id);
    const result = await this.messagesService.getOrCreateConversation(app.user_id, app.musician?.name);
    this.contactingApp.set(null);
    if (!result || 'error' in result) {
      this.toast.error('No se pudo abrir la conversación.');
      return;
    }
    this.notifyApplicationReviewed(app);
    this.router.navigate(['/inbox', result.id], { state: { name: app.musician?.name } });
  }

  /** Applications already told "revisada" during this visit: one notice per application. */
  private reviewedNotified = new Set<string>();

  /** Best effort: the musician learns the band looked at their application. */
  private notifyApplicationReviewed(app: VacancyApplication) {
    const band = this.band();
    if (!band || !app.user_id || app.user_id === this.currentUserId() || this.reviewedNotified.has(app.id)) return;
    this.reviewedNotified.add(app.id);
    this.notifSvc.create(
      app.user_id, 'application',
      applicationReviewedTitle(band.name),
      applicationReviewedBody(app.band_vacancies?.instrument),
      'band', band.id
    ).catch(() => undefined);
  }

  vacancyApplicationCount(vacancyId: string): number {
    return this.applications().filter(a => a.vacancy_id === vacancyId).length;
  }

  async shareLink() {
    const band = this.band();
    if (!band) return;
    const url = `${window.location.origin}/bands/${band.id}`;
    if (navigator.share) {
      await navigator.share({ title: band.name, url }).catch(() => {});
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
