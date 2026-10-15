import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AcceptError, BandInviteInfo, BandInvitesService } from '../../../core/services/band-invites.service';
import { imageSrc } from '../../../core/utils/display.utils';

/** Who is looking at the invite. */
type Viewer = 'loading' | 'guest' | 'no-profile' | 'musician' | 'other-profile';

const PROFILE_NAMES: Readonly<Record<string, string>> = {
  band: 'banda', venue: 'sala', teacher: 'profesor', rehearsal: 'local de ensayo', listener: 'oyente',
};

const ACCEPT_MESSAGES: Readonly<Record<AcceptError, string>> = {
  need_musician: 'Para unirte necesitas un perfil de músico.',
  own_band: 'Esta invitación es de tu propia banda: mándasela al integrante.',
  already_member: 'Ya estás en la formación de esta banda.',
  used: 'Esta invitación ya se ha usado.',
  expired: 'Esta invitación ha caducado. Pide a la banda que te mande otra.',
  invalid: 'Este enlace no es válido.',
  not_signed_in: 'Entra en tu cuenta para aceptar.',
  error: 'No se pudo aceptar la invitación. Inténtalo de nuevo.',
};

/**
 * /unirse/:token — a band invited this person to its line-up. Says who invites,
 * that it takes a MUSICIAN profile, and leads them through sign-up, onboarding
 * or straight to "Unirme".
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-join-band',
  imports: [RouterLink],
  template: `
    <main class="min-h-screen bg-dark-900 pt-20 pb-16 px-4">
      <div class="max-w-lg mx-auto">
        @if (loading()) {
          <div class="h-64 bg-dark-800/40 animate-pulse" aria-hidden="true"></div>
          <p class="sr-only" role="status">Cargando invitación…</p>
        } @else if (!info() || info()!.status !== 'ok') {
          <section class="border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141210]" role="alert">
            <p class="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">Invitación</p>
            <h1 class="font-display text-4xl uppercase leading-none mt-2">{{ deadTitle() }}</h1>
            <p class="mt-3 text-sm">{{ deadText() }}</p>
            <div class="mt-5 flex flex-wrap gap-2">
              @if (info()?.band_id) { <a [routerLink]="['/bands', info()!.band_id]" class="btn-secondary min-h-[44px]">Ver la banda</a> }
              <a routerLink="/" class="btn-ghost min-h-[44px]">Ir a BandYou</a>
            </div>
          </section>
        } @else if (joined()) {
          <section class="border-2 border-ink bg-poster-yellow p-6 shadow-[4px_4px_0_0_#141210]" role="status">
            <p class="font-mono text-xs font-bold uppercase tracking-wide">Hecho</p>
            <h1 class="font-display text-4xl uppercase leading-none mt-2">Ya estás en {{ info()!.band_name }}</h1>
            <p class="mt-3 text-sm">Sales en su formación con tu foto y tu perfil, y en tu perfil sale que tocas en {{ info()!.band_name }}.</p>
            <a [routerLink]="['/bands', info()!.band_id]" class="btn-night mt-5 min-h-[48px]">Ver la banda</a>
          </section>
        } @else {
          @let i = info()!;
          <section aria-labelledby="join-title">
            <div class="flex items-center gap-4">
              <span class="w-20 h-20 shrink-0 border-2 border-ink bg-ink overflow-hidden flex items-center justify-center font-display text-3xl text-poster-paper -rotate-2 shadow-[3px_3px_0_0_#c23a1f]">
                @if (i.band_avatar) { <img [src]="imageSrc(i.band_avatar, 192)" alt="" class="w-full h-full object-cover"/> }
                @else { {{ (i.band_name || '?').slice(0, 1) }} }
              </span>
              <div class="min-w-0">
                <p class="font-mono text-xs font-bold uppercase tracking-wide text-primary-500">Invitación a la formación</p>
                <p class="text-sm text-ink-muted truncate">{{ bandLine() }}</p>
              </div>
            </div>
            <h1 id="join-title" class="font-display text-[2.4rem] sm:text-5xl uppercase leading-[0.95] mt-5 break-words">
              Únete a {{ i.band_name }}
            </h1>
            @if (i.member_name || i.instrument) {
              <p class="mt-2 text-lg">Como <strong>{{ i.member_name }}</strong>@if (i.instrument) {<span> · {{ i.instrument }}</span>}</p>
            }

            <!-- The one thing people get wrong: it has to be a musician profile -->
            <div class="mt-6 border-2 border-ink bg-poster-yellow p-4">
              <p class="font-display text-2xl uppercase leading-none">Necesitas un perfil de músico</p>
              <p class="mt-2 text-sm">Cada cuenta de BandYou tiene un solo perfil. Para unirte tiene que ser de <strong>músico</strong>
                (no de banda): la banda ya existe, tú entras en ella. Es gratis y se hace en dos minutos.</p>
            </div>

            <ol class="mt-6 flex flex-col gap-3 text-sm">
              <li class="flex gap-3"><span class="w-7 h-7 shrink-0 bg-ink text-poster-paper font-display flex items-center justify-center">1</span>
                <span><strong>Crea tu perfil de músico</strong> (o entra si ya lo tienes).</span></li>
              <li class="flex gap-3"><span class="w-7 h-7 shrink-0 bg-ink text-poster-paper font-display flex items-center justify-center">2</span>
                <span><strong>Acepta la invitación</strong> con un toque.</span></li>
              <li class="flex gap-3"><span class="w-7 h-7 shrink-0 bg-ink text-poster-paper font-display flex items-center justify-center">3</span>
                <span>Sales en la formación de {{ i.band_name }} con tu foto, y en tu perfil, que tocas con ellos.</span></li>
            </ol>

            @if (error()) { <p class="mt-5 text-sm font-bold text-signal-red" role="alert">{{ error() }}</p> }

            <div class="mt-6 flex flex-col gap-2">
              @switch (viewer()) {
                @case ('loading') { <div class="h-12 bg-dark-800/40 animate-pulse" aria-hidden="true"></div> }
                @case ('guest') {
                  <button type="button" (click)="startSignUp()" class="btn-primary min-h-[52px] text-base">Crear mi perfil de músico</button>
                  <button type="button" (click)="signIn()" class="btn-secondary min-h-[48px]">Ya tengo perfil de músico · Entrar</button>
                  <p class="text-xs text-ink-muted">Si al registrarte te pide confirmar el email, después vuelve a abrir este enlace.</p>
                }
                @case ('no-profile') {
                  <button type="button" (click)="toOnboarding()" class="btn-primary min-h-[52px] text-base">Crear mi perfil de músico</button>
                }
                @case ('musician') {
                  <button type="button" (click)="accept()" [disabled]="busy()" class="btn-primary min-h-[52px] text-base disabled:opacity-60">
                    {{ busy() ? 'Uniéndote…' : 'Unirme a ' + i.band_name }}
                  </button>
                }
                @case ('other-profile') {
                  <p class="border-2 border-dashed border-ink/50 p-4 text-sm">
                    Has entrado con una cuenta de <strong>{{ otherProfile() }}</strong>. Para unirte como integrante necesitas
                    una cuenta de músico: cierra sesión y regístrate como músico con otro email.
                  </p>
                  <button type="button" (click)="signOut()" class="btn-secondary min-h-[48px]">Cerrar sesión</button>
                }
              }
              <a [routerLink]="['/bands', i.band_id]" class="btn-ghost min-h-[44px]">Ver la banda primero</a>
            </div>
          </section>
        }
      </div>
    </main>
  `,
})
export class JoinBandComponent implements OnInit {
  readonly imageSrc = imageSrc;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private invites = inject(BandInvitesService);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  readonly loading = signal(true);
  readonly info = signal<BandInviteInfo | null>(null);
  readonly viewer = signal<Viewer>('loading');
  readonly busy = signal(false);
  readonly joined = signal(false);
  readonly error = signal<string | null>(null);

  readonly bandLine = computed(() => ['Banda', this.info()?.band_genre, this.info()?.band_city].filter(Boolean).join(' · '));
  readonly otherProfile = computed(() => PROFILE_NAMES[this.auth.userProfileType()] ?? 'otro tipo');
  readonly deadTitle = computed(() => {
    switch (this.info()?.status) {
      case 'used': return 'Invitación ya usada';
      case 'expired': return 'Invitación caducada';
      case 'invalid': return 'Enlace no válido';
      default: return 'No se pudo cargar';
    }
  });
  readonly deadText = computed(() => {
    switch (this.info()?.status) {
      case 'used': return 'Alguien ya se ha unido con este enlace. Si eras tú, ya sales en la banda.';
      case 'expired': return 'Las invitaciones duran 14 días. Pide a la banda que te mande otra.';
      case 'invalid': return 'Revisa que el enlace esté completo o pide a la banda que te lo mande otra vez.';
      default: return 'Revisa tu conexión y vuelve a abrir el enlace.';
    }
  });

  async ngOnInit() {
    const [info, { data: { session } }] = await Promise.all([
      this.invites.info(this.token).catch(() => null),
      this.supabase.auth.getSession(),
    ]);
    this.info.set(info);
    this.loading.set(false);
    if (info?.status !== 'ok') { if (info) this.invites.clearPending(); return; }

    const uid = session?.user.id;
    if (!uid) { this.viewer.set('guest'); return; }
    // Back here signed in: the return URL kept for login has done its job.
    try {
      if (sessionStorage.getItem('bandyou_return_url') === `/unirse/${this.token}`) sessionStorage.removeItem('bandyou_return_url');
    } catch { /* storage blocked */ }
    await this.auth.loadUserProfile(uid).catch(() => undefined);
    const type = this.auth.userProfileData() ? this.auth.userProfileType() : '';
    this.viewer.set(!type ? 'no-profile' : type === 'musician' ? 'musician' : 'other-profile');
  }

  /** New here: sign up as a musician, then onboarding brings them back to this page. */
  startSignUp() {
    this.keepForLater();
    this.router.navigate(['/auth/register']);
  }

  signIn() {
    this.keepForLater();
    this.router.navigate(['/auth/login']);
  }

  toOnboarding() {
    this.keepForLater();
    this.router.navigate(['/onboarding']);
  }

  async accept() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const r = await this.invites.accept(this.token);
      if ('bandId' in r) {
        this.invites.clearPending();
        this.joined.set(true);
      } else {
        this.error.set(ACCEPT_MESSAGES[r.error]);
        if (r.error === 'used' || r.error === 'expired' || r.error === 'invalid' || r.error === 'already_member') this.invites.clearPending();
      }
    } catch {
      this.error.set(ACCEPT_MESSAGES.error);
    } finally {
      this.busy.set(false);
    }
  }

  async signOut() {
    this.keepForLater();
    await this.auth.signOut();
  }

  /** The invite survives sign-up (even an email confirmation in another tab) and onboarding. */
  private keepForLater() {
    this.invites.rememberPending(this.token);
    try {
      localStorage.setItem('bandyou_role', 'musician');
      sessionStorage.setItem('bandyou_return_url', `/unirse/${this.token}`);
    } catch { /* storage blocked */ }
  }
}
