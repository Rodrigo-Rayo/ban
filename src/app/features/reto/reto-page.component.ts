import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { MediaFeaturesService } from '../../core/services/media-features.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { mediaEmbed } from '../../core/utils/media-embed';
import { Challenge, ChallengeEntry, challengePhase, entryHost, isValidEntryUrl, timeLeft } from '../../core/utils/reto';
import { ListenPlayerComponent } from '../../shared/components/listen-player/listen-player.component';
import { RetoService } from './reto.service';

const PROFILE_SEGMENT: Record<string, string> = {
  musician: 'musicians', band: 'bands', venue: 'venues', teacher: 'teachers', rehearsal: 'rehearsal',
};
export const MAX_CAPTION_LENGTH = 140;

/**
 * Reto del mes: one theme a month. People post their take on their own Instagram,
 * YouTube, TikTok… and paste the link here; every take is on show, newest first.
 * No votes: BandYou shares the best ones on its own channels.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reto-page',
  imports: [FormsModule, RouterLink, ListenPlayerComponent],
  templateUrl: './reto-page.component.html',
})
export class RetoPageComponent implements OnInit {
  private reto = inject(RetoService);
  private auth = inject(AuthService);
  private features = inject(MediaFeaturesService);
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private destroyRef = inject(DestroyRef);

  readonly MAX_CAPTION_LENGTH = MAX_CAPTION_LENGTH;
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly challenge = signal<Challenge | null>(null);
  readonly entries = signal<ChallengeEntry[]>([]);
  readonly busy = signal(false);
  /** Read from Supabase on load (the auth signal may not be filled yet on a hard reload). */
  readonly userId = signal<string | null>(null);
  /** Ticks every minute so deadlines close on an open tab. */
  private readonly now = signal(new Date());
  readonly hasProfile = computed(() => !!this.auth.userProfileData());

  form = { url: '', caption: '' };

  readonly phase = computed(() => { const c = this.challenge(); return c ? challengePhase(c, this.now()) : null; });
  readonly myEntry = computed(() => this.entries().find(e => e.user_id === this.userId()) ?? null);
  readonly deadline = computed(() => {
    const c = this.challenge();
    if (!c) return '';
    if (this.phase() === 'entries') return `Participa hasta el ${this.dateText(c.entries_until)} · ${timeLeft(c.entries_until, this.now())}`;
    return `Cerrado el ${this.dateText(c.entries_until)}`;
  });

  async ngOnInit() {
    this.seo.set({ title: 'Reto del mes', description: 'Cada mes, un reto musical en BandYou: sube tu versión y descubre la de otros músicos y bandas.' });
    const tick = setInterval(() => this.now.set(new Date()), 60000);
    this.destroyRef.onDestroy(() => clearInterval(tick));
    try {
      if (!(await this.features.has('reto'))) return;
      const { data: { user } } = await this.supabase.auth.getUser();
      this.userId.set(user?.id ?? null);
      const [challenge] = await Promise.all([this.reto.current(), user ? this.auth.loadUserProfile(user.id) : Promise.resolve()]);
      this.challenge.set(challenge);
      if (challenge) await this.refresh(challenge.id);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async refresh(challengeId: string) {
    this.entries.set(await this.reto.entries(challengeId));
  }

  urlOk(): boolean { return isValidEntryUrl(this.form.url); }
  canSubmit(): boolean { return this.urlOk() && this.form.caption.trim().length <= MAX_CAPTION_LENGTH && !this.busy(); }

  async submit() {
    const c = this.challenge(), uid = this.userId(), profile = this.auth.userProfileData();
    if (!c || !uid || !profile || !this.canSubmit()) return;
    this.busy.set(true);
    try {
      // Name and profile link are filled in by the database from the account's own profile.
      await this.reto.enter(c.id, uid, { url: this.form.url.trim(), caption: this.form.caption.trim() || null });
      this.form = { url: '', caption: '' };
      this.toast.success('¡Ya participas! Compártelo para que lo vea más gente.');
      await this.refresh(c.id);
    } catch {
      this.toast.error('No se pudo enviar. Revisa el enlace o inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  async withdraw(e: ChallengeEntry) {
    const c = this.challenge(), uid = this.userId();
    if (!c || !uid) return;
    const ok = await this.confirm.ask({ title: '¿Retirar tu participación?', message: 'Dejará de verse en el reto.', confirmLabel: 'Retirar', danger: true });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.reto.withdraw(e.id, uid);
      await this.refresh(c.id);
    } catch {
      this.toast.error('No se pudo retirar.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Plays inside the page (YouTube, Spotify, SoundCloud); others open on their site. */
  playsHere(e: ChallengeEntry): boolean { return mediaEmbed(e.url) !== null; }
  /** Only links to the accepted sites are shown (the database only checks https). */
  hostOf(e: ChallengeEntry): string | null { return entryHost(e.url); }

  profileRoute(e: ChallengeEntry): string[] | null {
    const seg = e.author_profile_type ? PROFILE_SEGMENT[e.author_profile_type] : null;
    return seg && e.author_profile_id ? [`/${seg}`, e.author_profile_id] : null;
  }

  private dateText(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  }
}
