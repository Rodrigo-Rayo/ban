import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { MessagesService } from '../../../core/services/messages.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarColor } from '../../../core/utils/display.utils';

@Component({
  selector: 'app-band-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './band-profile.component.html',
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

  band = signal<any>(null);
  vacancies = signal<any[]>([]);
  members = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  myMusicianId = signal<string | null>(null);
  myMusicianUserId = signal<string | null>(null);
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
  readonly instruments = ['Guitarra', 'Bajo', 'Batería', 'Teclados', 'Voz', 'Violín', 'Trompeta', 'Saxofón', 'Piano', 'Percusión', 'Otro'];
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk', 'Cualquiera'];

  applications = signal<any[]>([]);
  applicationsLoading = signal(false);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }

    try {
      // Round 1: all 4 independent queries in parallel
      const [
        { data: band },
        { data: { session } },
        { data: vac },
        { data: membersData },
      ] = await Promise.all([
        this.supabase.client.from('bands').select('*').eq('id', id).maybeSingle(),
        this.supabase.auth.getSession(),
        this.supabase.client.from('band_vacancies').select('id, instrument, description, genre, open').eq('band_id', id).order('created_at'),
        this.supabase.client.from('band_members').select('id, name, instrument').eq('band_id', id).order('created_at'),
      ]);

      this.band.set(band);
      if (band) {
        this.seo.setProfile(band.name, 'band', band.city, band.description, band.avatar_url);
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
      }
      this.vacancies.set(vac || []);
      this.members.set(membersData || []);
      this.loading.set(false);

      if (!session) return;
      this.currentUserId.set(session.user.id);

      // Round 2: musician lookup and isFav in parallel
      const [{ data: musician }] = await Promise.all([
        this.supabase.client.from('musicians').select('id, user_id').eq('user_id', session.user.id).maybeSingle(),
        band ? this.favSvc.isFavorite(session.user.id, 'band', band.id).then(v => this.isFav.set(v)) : Promise.resolve(),
      ]);

      if (musician) {
        this.myMusicianId.set(musician.id);
        this.myMusicianUserId.set(musician.user_id);
        const { data: apps } = await this.supabase.client
          .from('vacancy_applications').select('vacancy_id').eq('musician_id', musician.id);
        this.appliedVacancies.set((apps || []).map((a: any) => a.vacancy_id));
      }

      if (band && session.user.id === band.user_id) {
        this.loadApplications();
      }
    } catch {
      this.toast.error('No se pudo cargar el perfil de la banda. Inténtalo de nuevo.');
      this.loading.set(false);
    }
  }

  readonly isOwner = computed(() => !!(this.currentUserId() && this.band()?.user_id === this.currentUserId()));
  readonly openVacancies = computed(() => this.vacancies().filter((v: any) => v.open));
  readonly closedVacancies = computed(() => this.vacancies().filter((v: any) => !v.open));

  async createVacancy() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    if (!this.newVacancy.instrument) return;
    this.vacancyLoading.set(true);
    const { data, error } = await this.supabase.client.from('band_vacancies').insert({
      band_id: this.band()!.id,
      instrument: this.newVacancy.instrument,
      description: this.newVacancy.description,
      genre: this.newVacancy.genre,
      open: true,
    }).select().single();
    this.vacancyLoading.set(false);
    if (error) { this.toast.error('No se pudo crear la vacante.'); return; }
    if (data) {
      this.vacancies.update(v => [...v, data]);
      this.newVacancy = { instrument: '', description: '', genre: '' };
      this.showVacancyForm.set(false);
      this.toast.success('Vacante creada correctamente.');
    }
  }

  async loadApplications() {
    this.applicationsLoading.set(true);
    try {
      const vacancyIds = this.vacancies().map((v: any) => v.id);
      if (vacancyIds.length === 0) return;
      const { data: apps, error } = await this.supabase.client
        .from('vacancy_applications')
        .select('*, band_vacancies(instrument)')
        .in('vacancy_id', vacancyIds)
        .order('created_at', { ascending: false });
      if (error) { this.toast.error('No se pudieron cargar las solicitudes.'); return; }
      const musicianIds = [...new Set((apps || []).map((a: any) => a.musician_id).filter(Boolean))];
      const { data: musicians } = musicianIds.length
        ? await this.supabase.client.from('musicians').select('id, name, city, genre, avatar_url').in('id', musicianIds)
        : { data: [] };
      const musicianMap = new Map((musicians || []).map((m: any) => [m.id, m]));
      this.applications.set((apps || []).map((app: any) => ({ ...app, musician: musicianMap.get(app.musician_id) ?? null })));
    } finally {
      this.applicationsLoading.set(false);
    }
  }

  async closeVacancy(id: string) {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    if (!confirm('¿Cerrar esta vacante?')) return;
    const { error } = await this.supabase.client.from('band_vacancies').update({ open: false }).eq('id', id);
    if (error) { this.toast.error('No se pudo cerrar la vacante.'); return; }
    this.vacancies.update(v => v.map(x => x.id === id ? { ...x, open: false } : x));
  }

  async reopenVacancy(id: string) {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    const { error } = await this.supabase.client.from('band_vacancies').update({ open: true }).eq('id', id);
    if (error) { this.toast.error('No se pudo reabrir la vacante.'); return; }
    this.vacancies.update(v => v.map(x => x.id === id ? { ...x, open: true } : x));
  }

  hasApplied(vacancyId: string) {
    return this.appliedVacancies().includes(vacancyId);
  }

  openApply(vacancyId: string) {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    if (this.currentUserId() === this.band()?.user_id) {
      this.toast.error('No puedes postularte a las vacantes de tu propia banda.');
      return;
    }
    if (!this.myMusicianId()) {
      this.toast.error('Solo los músicos pueden postularse a vacantes. Crea un perfil de músico en tu panel.');
      return;
    }
    this.applyingTo.set(vacancyId);
    this.applyMessage = '';
  }

  async submitApply() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
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
        this.toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
        return;
      }
      this.appliedVacancies.update(arr => [...arr, vacancyId]);
      this.applySuccess.set(vacancyId);
      this.applyingTo.set(null);
      setTimeout(() => this.applySuccess.set(null), 3000);
      if (this.band()?.user_id) {
        const vacancy = this.vacancies().find(v => v.id === vacancyId);
        await this.notifSvc.create(
          this.band()!.user_id, 'application',
          'Nueva solicitud para tu banda',
          `Alguien se ha postulado para la vacante de ${vacancy?.instrument || 'músico'}.`,
          'band', this.band()!.id
        );
      }
    } catch {
      this.toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      this.applyLoading.set(false);
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
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
    if (!uid) { this.router.navigate(['/auth/login']); return; }
    if (uid === this.band()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.band()!.user_id, this.band()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.band()!.name } });
  }

  contactingApp = signal<string | null>(null);

  async contactApplicant(app: any) {
    const uid = this.currentUserId();
    if (!uid || !app.user_id) return;
    this.contactingApp.set(app.id);
    const result = await this.messagesService.getOrCreateConversation(app.user_id, app.musician?.name);
    this.contactingApp.set(null);
    if (!result || 'error' in result) {
      this.toast.error('No se pudo abrir la conversación.');
      return;
    }
    this.router.navigate(['/inbox', result.id], { state: { name: app.musician?.name } });
  }

  vacancyApplicationCount(vacancyId: string): number {
    return this.applications().filter(a => a.vacancy_id === vacancyId).length;
  }

  async shareLink() {
    const url = `${window.location.origin}/bands/${this.band()!.id}`;
    if (navigator.share) {
      await navigator.share({ title: this.band()!.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      this.linkShared.set(true);
      setTimeout(() => this.linkShared.set(false), 2000);
    }
  }

}
