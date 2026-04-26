import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { MessagesService } from '../../../core/services/messages.service';

@Component({
  selector: 'app-band-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './band-profile.component.html',
})
export class BandProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messagesService = inject(MessagesService);
  private favSvc = inject(FavoritesService);
  private notifSvc = inject(NotificationsService);

  band = signal<any>(null);
  vacancies = signal<any[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  myMusicianId = signal<string | null>(null);
  myMusicianUserId = signal<string | null>(null);
  appliedVacancies = signal<string[]>([]);
  isFav = signal(false);
  favLoading = signal(false);

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

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const [{ data: band }, { data: { session } }] = await Promise.all([
      this.supabase.client.from('bands').select('*').eq('id', id!).single(),
      this.supabase.auth.getSession(),
    ]);
    this.band.set(band);

    const { data: vac } = await this.supabase.client
      .from('band_vacancies').select('*').eq('band_id', id!).eq('open', true).order('created_at');
    this.vacancies.set(vac || []);

    if (session) {
      this.currentUserId.set(session.user.id);
      const { data: musician } = await this.supabase.client
        .from('musicians').select('id, user_id').eq('user_id', session.user.id).maybeSingle();
      if (musician) {
        this.myMusicianId.set(musician.id);
        this.myMusicianUserId.set(musician.user_id);
        const { data: apps } = await this.supabase.client
          .from('vacancy_applications').select('vacancy_id').eq('musician_id', musician.id);
        this.appliedVacancies.set((apps || []).map((a: any) => a.vacancy_id));
      }
      if (band) {
        this.isFav.set(await this.favSvc.isFavorite(session.user.id, 'band', band.id));
      }
    }
    this.loading.set(false);
  }

  get isOwner() {
    return this.currentUserId() && this.band()?.user_id === this.currentUserId();
  }

  async createVacancy() {
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
    if (!error && data) {
      this.vacancies.update(v => [...v, data]);
      this.newVacancy = { instrument: '', description: '', genre: '' };
      this.showVacancyForm.set(false);
    }
  }

  async closeVacancy(id: string) {
    if (!confirm('¿Cerrar esta vacante?')) return;
    await this.supabase.client.from('band_vacancies').update({ open: false }).eq('id', id);
    this.vacancies.update(v => v.filter(x => x.id !== id));
  }

  hasApplied(vacancyId: string) {
    return this.appliedVacancies().includes(vacancyId);
  }

  openApply(vacancyId: string) {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.applyingTo.set(vacancyId);
    this.applyMessage = '';
  }

  async submitApply() {
    const vacancyId = this.applyingTo();
    if (!vacancyId || !this.myMusicianId()) return;
    this.applyLoading.set(true);
    const { error } = await this.supabase.client.from('vacancy_applications').insert({
      vacancy_id: vacancyId,
      musician_id: this.myMusicianId(),
      user_id: this.currentUserId(),
      message: this.applyMessage,
    });
    this.applyLoading.set(false);
    if (!error) {
      this.appliedVacancies.update(arr => [...arr, vacancyId]);
      this.applySuccess.set(vacancyId);
      this.applyingTo.set(null);
      setTimeout(() => this.applySuccess.set(null), 3000);
      // Notify the band owner
      if (this.band()?.user_id) {
        const vacancy = this.vacancies().find(v => v.id === vacancyId);
        await this.notifSvc.create(
          this.band()!.user_id, 'application',
          'Nueva solicitud para tu banda',
          `Alguien se ha postulado para la vacante de ${vacancy?.instrument || 'músico'}.`,
          'band', this.band()!.id
        );
      }
    }
  }

  async toggleFav() {
    if (!this.currentUserId()) { this.router.navigate(['/auth/login']); return; }
    this.favLoading.set(true);
    const result = await this.favSvc.toggle(this.currentUserId()!, 'band', this.band()!.id);
    this.isFav.set(result);
    this.favLoading.set(false);
  }

  async sendMessage() {
    const session = (await this.supabase.auth.getSession()).data.session;
    if (!session) { this.router.navigate(['/auth/login']); return; }
    if (session.user.id === this.band()!.user_id) { this.router.navigate(['/inbox']); return; }
    this.sending.set(true);
    this.msgError.set(null);
    const result = await this.messagesService.getOrCreateConversation(this.band()!.user_id, this.band()!.name);
    this.sending.set(false);
    if (!result) return;
    if ('error' in result) { this.msgError.set(result.error); return; }
    this.router.navigate(['/inbox', result.id], { state: { name: this.band()!.name } });
  }
}
