import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { CITIES } from '../../core/constants/cities';
import { QuedadaEvent, QuedadaService } from './quedada.service';
import { NO_PROVINCE, QuedadaSnapshot, QuedadaStatusComponent } from './quedada-status.component';
import { QuedadaSocialComponent } from './quedada-social.component';
import { drawLabel, eligibleDates, monthName, openCycle } from '../../core/utils/quedada-cycle';
import { dateParts } from '../../core/utils/date';

/** /quedada — "La quedada de BandYou": status, sign-up, the winner's page and the rules. */
@Component({
  selector: 'app-quedada-page',
  imports: [RouterLink, FormsModule, QuedadaStatusComponent, QuedadaSocialComponent],
  template: `
    <div class="min-h-screen bg-dark-900 pb-16" style="padding-top:64px">
      <header class="page-head">
        <div class="page-head-inner">
          <div>
            <p class="page-kicker">Ayudamos a las bandas a darse a conocer</p>
            <h1 class="page-title">La quedada de BandYou</h1>
          </div>
        </div>
      </header>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-8">
        @if (svc.demoState) {
          <p class="border-2 border-dashed border-primary-500 px-3 py-2 text-sm font-bold text-primary-600">
            MODO DEMO (solo en local): datos inventados, nada se guarda.
            Fases: <a class="underline" href="/quedada?demo=inscripcion">inscripción</a> ·
            <a class="underline" href="/quedada?demo=ganador">ganador</a> ·
            <a class="underline" href="/quedada?demo=vacio">sin inscritos</a>
          </p>
          <div>
            <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-2">Así se ve en la portada:</p>
            <app-quedada-status [province]="province()" variant="home"/>
          </div>
          <p class="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-muted -mb-4">Y así en esta página:</p>
        }

        <div class="flex flex-wrap items-center gap-3">
          <label for="q-province" class="font-mono text-[11px] font-bold uppercase tracking-wide">Provincia</label>
          <select id="q-province" [ngModel]="province()" (ngModelChange)="pickProvince($event)" class="input-field w-auto min-h-[44px]">
            @for (c of provinces; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>

        <app-quedada-status [province]="province()" [refresh]="refreshKey()" variant="page" (loaded)="snapshot.set($event)"/>

        @if (snapshot(); as s) {
          @if (s.winner && s.phase === 'winner') {
            <div>
              <a [routerLink]="['/events', s.winner.event.id]" class="btn-secondary min-h-[44px] text-xs px-5 mb-6">Ver el bolo completo</a>
              <app-quedada-social [winner]="s.winner"/>
            </div>
          }

          <!-- Inscribir -->
          <section id="inscribir" class="card-flat p-4 sm:p-6 scroll-mt-24" aria-labelledby="q-signup-title">
            <h2 id="q-signup-title" class="text-3xl leading-none">Inscribe tu bolo</h2>
            <p class="text-sm text-ink-muted mt-2">
              Sorteo de {{ month() }}: bolos en tu provincia del {{ range()[0] }} al {{ range()[1] }}. Inscripción hasta el {{ drawText() }} a las 20:00. Uno por cuenta.
            </p>
            @if (!loggedIn()) {
              <a routerLink="/auth/login" class="btn-primary mt-4 min-h-[48px] px-8 text-sm">Entrar para inscribir mi bolo</a>
            } @else if (myEntryEvent(); as e) {
              <div class="mt-4 border-2 border-ink bg-poster-yellow p-3">
                <p class="font-bold">¡Inscrito! {{ e.title }}</p>
                <p class="text-sm">{{ eventLine(e) }}</p>
              </div>
              <button type="button" (click)="withdraw()" [disabled]="busy()" class="btn-ghost mt-3 min-h-[44px] text-xs">Retirar mi inscripción</button>
            } @else if (myEvents().length) {
              <ul class="mt-4 flex flex-col gap-2">
                @for (e of myEvents(); track e.id) {
                  <li class="flex items-center justify-between gap-3 border-2 border-ink p-3 bg-dark-800">
                    <span class="min-w-0">
                      <span class="block font-bold truncate">{{ e.title }}</span>
                      <span class="block text-sm text-ink-muted truncate">{{ eventLine(e) }}</span>
                    </span>
                    <button type="button" (click)="signUp(e)" [disabled]="busy()" class="btn-primary min-h-[44px] px-5 text-xs flex-shrink-0">Inscribir</button>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm mt-4">No tienes bolos en la Agenda entre esas fechas.</p>
              <a routerLink="/events/create" class="btn-night mt-3 min-h-[44px] px-6 text-xs">Publicar un bolo</a>
            }
          </section>

          <!-- Inscritos -->
          @if (!noProvince()) {
            <section aria-labelledby="q-entries-title">
              <h2 id="q-entries-title" class="text-3xl leading-none">Inscritos en {{ province() }} · {{ month() }}</h2>
              @if (s.entries.length) {
                <ul class="mt-3 border-t border-ink/20">
                  @for (en of s.entries; track en.id) {
                    <li class="border-b border-ink/15">
                      <a [routerLink]="['/events', en.event.id]" class="flex items-center justify-between gap-3 py-3 px-1 hover:bg-dark-800">
                        <span class="min-w-0">
                          <span class="block font-display uppercase text-xl leading-tight truncate">{{ en.event.owner_name }}</span>
                          <span class="block text-sm text-ink-muted truncate">{{ en.event.title }} · {{ eventLine(en.event) }}</span>
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-ink-muted mt-2">Todavía nadie. Si te inscribes y eres el único, ganas.</p>
              }
            </section>
          }
        }

        <!-- Cómo funciona -->
        <section aria-labelledby="q-how-title">
          <h2 id="q-how-title" class="text-3xl leading-none">Cómo funciona</h2>
          <ol class="mt-4 grid sm:grid-cols-3 gap-3">
            <li class="card-flat p-4"><p class="font-display text-4xl text-primary-500 leading-none">01</p><p class="font-bold mt-2">Inscribe tu bolo</p><p class="text-sm text-ink-muted mt-1">Cada mes tiene su sorteo. Inscribe un bolo de tu Agenda de ese mes, en tu provincia, hasta el día 20 del mes anterior a las 20:00.</p></li>
            <li class="card-flat p-4"><p class="font-display text-4xl text-primary-500 leading-none">02</p><p class="font-bold mt-2">Sorteo automático</p><p class="text-sm text-ink-muted mt-1">El día 20 a las 20:00 sale un ganador al azar en cada provincia. Sin votos ni trampas.</p></li>
            <li class="card-flat p-4"><p class="font-display text-4xl text-primary-500 leading-none">03</p><p class="font-bold mt-2">¡Quedamos!</p><p class="text-sm text-ink-muted mt-1">Lo promocionamos en la portada de tu provincia. Apúntate, comenta y ve a conocer gente de la escena.</p></li>
          </ol>
        </section>

        <!-- Bases -->
        <details class="card-flat p-4 sm:p-6">
          <summary class="font-display uppercase text-2xl cursor-pointer">Bases del sorteo</summary>
          <ol class="list-decimal pl-5 mt-4 text-sm leading-relaxed flex flex-col gap-2">
            <li>Participar es gratis. Puede inscribirse cualquier cuenta de BandYou que haya publicado un bolo en la Agenda.</li>
            <li>Cada mes tiene su propio sorteo. Cada cuenta puede inscribir un bolo por sorteo, que debe celebrarse en la provincia indicada y dentro de ese mes.</li>
            <li>Las inscripciones de cada mes cierran el día 20 del mes anterior a las 20:00 (hora peninsular). Hasta entonces puedes retirar tu inscripción.</li>
            <li>El sorteo es automático y aleatorio entre los bolos inscritos de cada provincia. Si solo hay uno, gana ese.</li>
            <li>El premio es promocional: el bolo se muestra destacado en la portada de su provincia y en esta página hasta el día del concierto. No incluye dinero ni otros premios, salvo que se anuncie lo contrario.</li>
            <li>El concierto lo organiza la banda o la sala, no BandYou. Quienes se apuntan van por su cuenta.</li>
            <li>Si un bolo se cancela o se borra, deja de participar. BandYou puede retirar bolos o comentarios que incumplan los Términos de Uso.</li>
          </ol>
        </details>
      </div>
    </div>
  `,
})
export class QuedadaPageComponent {
  readonly svc = inject(QuedadaService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);

  readonly provinces = CITIES.filter(c => c !== 'Otra');
  readonly province = signal(initialProvince());
  readonly snapshot = signal<QuedadaSnapshot | null>(null);
  readonly loggedIn = computed(() => this.auth.isLoggedIn() || !!this.svc.demoState);
  readonly noProvince = computed(() => NO_PROVINCE.includes(this.province()));
  readonly myEvents = signal<QuedadaEvent[]>([]);
  readonly myEntry = signal<{ id: string; event_id: string } | null>(null);
  readonly busy = signal(false);
  readonly month = computed(() => monthName(openCycle(this.svc.now())));
  readonly drawText = computed(() => drawLabel(openCycle(this.svc.now())));
  readonly range = computed(() => eligibleDates(openCycle(this.svc.now())).map(d => {
    const p = dateParts(d);
    return p ? `${p.day} ${p.month}` : d;
  }));
  readonly myEntryEvent = computed(() => {
    const entry = this.myEntry();
    if (!entry) return null;
    return this.myEvents().find(e => e.id === entry.event_id)
      ?? this.snapshot()?.entries.find(e => e.event.id === entry.event_id)?.event ?? null;
  });

  constructor() {
    this.seo.set({
      title: 'La quedada de BandYou',
      description: 'Ayudamos a las bandas a darse a conocer: cada mes sorteamos un bolo por provincia, lo promocionamos y quedamos para ir. Inscribe el tuyo gratis.',
    });
    // The profile's province once it is known, unless the visitor already picked one.
    effect(() => {
      const city = this.auth.userProfileData()?.city;
      if (city && !NO_PROVINCE.includes(city) && !this.pickedByHand) this.province.set(city);
    });
    effect(() => {
      const uid = this.auth.user()?.id ?? (this.svc.demoState ? 'demo-me' : null);
      if (uid) void this.loadMine(uid);
    });
  }

  private mineSeq = 0;

  private async loadMine(uid = this.auth.user()?.id ?? (this.svc.demoState ? 'demo-me' : null)) {
    if (!uid) return;
    const seq = ++this.mineSeq;
    const [events, entry] = await Promise.all([this.svc.myEligibleEvents(uid), this.svc.myEntry(uid, openCycle(this.svc.now()))]);
    if (seq !== this.mineSeq) return;
    this.myEvents.set(events);
    this.myEntry.set(entry);
  }

  async signUp(e: QuedadaEvent) {
    this.busy.set(true);
    const error = await this.svc.signUp(e.id);
    this.busy.set(false);
    if (error) { this.toast.error(error); return; }
    this.toast.success(`¡Bolo inscrito! El sorteo es el ${this.drawText()} a las 20:00.`);
    if (e.city && e.city !== this.province()) this.province.set(e.city);
    await this.loadMine();
    this.refreshStatus();
  }

  async withdraw() {
    const entry = this.myEntry();
    if (!entry) return;
    this.busy.set(true);
    const ok = await this.svc.withdraw(entry.id);
    this.busy.set(false);
    if (!ok) { this.toast.error('No se pudo retirar la inscripción.'); return; }
    this.toast.success('Inscripción retirada.');
    await this.loadMine();
    this.refreshStatus();
  }

  readonly refreshKey = signal(0);
  private pickedByHand = false;

  pickProvince(value: string) {
    this.pickedByHand = true;
    this.province.set(value);
  }

  private refreshStatus() {
    this.refreshKey.update(n => n + 1);
  }

  eventLine(e: QuedadaEvent): string {
    const p = dateParts(e.date.slice(0, 10));
    return [p ? `${p.weekday} ${p.day} ${p.month}` : e.date, e.time?.slice(0, 5), e.venue, e.city].filter(Boolean).join(' · ');
  }
}

function initialProvince(): string {
  try { return localStorage.getItem('bandyou_city') || 'Madrid'; } catch { return 'Madrid'; }
}
