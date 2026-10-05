import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { QuedadaComment, QuedadaPerson, QuedadaService, QuedadaWinner } from './quedada.service';
import { avatarColor, timeAgo } from '../../core/utils/display.utils';
import { initialOf } from '../inbox/profile-avatar';

const MAX_COMMENT = 500;
const PROFILE_ROUTES: Record<string, string> = {
  musician: '/musicians', band: '/bands', venue: '/venues', teacher: '/teachers', rehearsal: '/rehearsal',
};

/**
 * The winner's social side: "¡Voy!", who is going, and the comment thread.
 * Signed-out visitors see the counts and an invitation to sign in.
 */
@Component({
  selector: 'app-quedada-social',
  imports: [RouterLink, FormsModule],
  template: `
    <!-- ¿Quién va? -->
    <section class="card-flat p-4 sm:p-6" aria-labelledby="q-going-title">
      <div class="flex items-end justify-between gap-3 flex-wrap">
        <h2 id="q-going-title" class="text-3xl leading-none">¿Quién va?</h2>
        <span class="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">{{ count() }} {{ count() === 1 ? 'persona' : 'personas' }}</span>
      </div>
      @if (loggedIn()) {
        @if (people().length) {
          <ul class="flex flex-wrap gap-2 mt-4" aria-label="Personas que van">
            @for (p of people(); track p.user_id) {
              <li>
                <a [routerLink]="routeOf(p.profile_type, p.profile_id)" class="flex flex-col items-center w-16 text-center group" [attr.aria-label]="p.name">
                  <span class="avatar w-12 h-12 text-base border-2 border-ink overflow-hidden" [style.background]="p.avatar_url ? null : color(p.name)">
                    @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" class="w-full h-full object-cover" loading="lazy"/> } @else { {{ initial(p.name) }} }
                  </span>
                  <span class="text-[11px] font-bold truncate w-full mt-1 group-hover:text-primary-600">{{ p.name }}</span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="text-sm text-ink-muted mt-3">Todavía no se ha apuntado nadie. ¡Sé el primero!</p>
        }
        <button type="button" (click)="toggleGoing()" [disabled]="busy()"
          class="mt-5 min-h-[48px] w-full sm:w-auto px-8 text-sm disabled:opacity-50"
          [class]="going() ? 'btn-secondary' : 'btn-primary'" [attr.aria-pressed]="going()">
          {{ going() ? 'Ya no voy' : '¡Voy!' }}
        </button>
        @if (going()) { <p class="text-sm mt-2 font-semibold">¡Genial! Saluda a la gente en los comentarios.</p> }
      } @else {
        <p class="text-sm mt-3">Entra para apuntarte, ver quién va y conocer gente antes del bolo.</p>
        <a routerLink="/auth/login" class="btn-primary mt-4 min-h-[48px] px-8 text-sm">Entrar para apuntarme</a>
      }
    </section>

    <!-- Comentarios -->
    <section class="card-flat p-4 sm:p-6 mt-6" aria-labelledby="q-comments-title">
      <h2 id="q-comments-title" class="text-3xl leading-none">Comentarios <span class="font-mono text-sm text-ink-muted align-middle">({{ commentTotal() }})</span></h2>
      @if (loggedIn()) {
        <ul class="mt-4 flex flex-col">
          @for (c of comments(); track c.id) {
            <li class="flex gap-3 py-3 border-b border-ink/15">
              <span class="avatar w-10 h-10 text-sm border-2 border-ink overflow-hidden flex-shrink-0" [style.background]="c.author_avatar ? null : color(c.author_name)">
                @if (c.author_avatar) { <img [src]="c.author_avatar" alt="" class="w-full h-full object-cover" loading="lazy"/> } @else { {{ initial(c.author_name) }} }
              </span>
              <div class="min-w-0 flex-1">
                <p class="flex items-baseline gap-2 flex-wrap">
                  <a [routerLink]="routeOf(c.author_profile_type, c.author_profile_id)" class="font-bold text-sm hover:text-primary-600">{{ c.author_name || 'Usuario' }}</a>
                  @if (c.user_id === winner().event.user_id) { <span class="tag-accent text-[10px]">Banda</span> }
                  <span class="meta">{{ ago(c.created_at) }}</span>
                </p>
                <p class="text-[15px] leading-relaxed mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]">{{ c.text }}</p>
              </div>
              @if (canDelete(c)) {
                <button type="button" (click)="remove(c)" class="font-mono text-[11px] font-bold uppercase text-ink-muted hover:text-signal-red min-h-[44px] px-2 self-start" [attr.aria-label]="'Borrar comentario de ' + (c.author_name || 'usuario')">Borrar</button>
              }
            </li>
          } @empty {
            <li class="text-sm text-ink-muted py-2">Nadie ha comentado todavía. Rompe el hielo: ¿con quién vas?, ¿desde dónde vienes?</li>
          }
        </ul>
        <form (ngSubmit)="send()" class="mt-4">
          <label for="q-comment" class="sr-only">Escribe un comentario</label>
          <textarea id="q-comment" name="comment" [(ngModel)]="draft" rows="2" [maxlength]="max"
            placeholder="¿Quién se viene? ¿Alguien de tu zona para ir juntos?" class="input-field resize-none"></textarea>
          <div class="flex items-center justify-between gap-3 mt-2">
            <span class="font-mono text-[11px] text-ink-muted">{{ draft.length }}/{{ max }}</span>
            <button type="submit" [disabled]="sending() || !draft.trim()" class="btn-night min-h-[44px] px-6 text-xs disabled:opacity-50">Publicar</button>
          </div>
        </form>
      } @else {
        <p class="text-sm mt-3">{{ commentTotal() ? 'Hay ' + commentTotal() + ' comentarios.' : 'Todavía no hay comentarios.' }} Entra para leerlos y escribir.</p>
      }
    </section>
  `,
})
export class QuedadaSocialComponent {
  private svc = inject(QuedadaService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly winner = input.required<QuedadaWinner>();

  readonly max = MAX_COMMENT;
  readonly loggedIn = computed(() => this.auth.isLoggedIn() || !!this.svc.demoState);
  readonly people = signal<QuedadaPerson[]>([]);
  readonly count = signal(0);
  readonly going = signal(false);
  readonly busy = signal(false);
  readonly comments = signal<QuedadaComment[]>([]);
  readonly commentTotal = signal(0);
  readonly sending = signal(false);
  draft = '';

  constructor() {
    effect(() => { void this.load(this.winner().event.id, this.loggedIn()); });
  }

  private myId(): string | null { return this.auth.user()?.id ?? (this.svc.demoState ? 'demo-me' : null); }

  private async load(eventId: string, loggedIn: boolean) {
    const uid = this.myId();
    const [count, total] = await Promise.all([this.svc.attendeeCount(eventId), this.svc.commentCount(eventId)]);
    this.count.set(count);
    this.commentTotal.set(total);
    if (!loggedIn) return;
    const [people, going, comments] = await Promise.all([
      this.svc.people(eventId), uid ? this.svc.amGoing(eventId, uid) : Promise.resolve(false), this.svc.comments(eventId),
    ]);
    this.people.set(people);
    this.going.set(going);
    this.comments.set(comments);
  }

  async toggleGoing() {
    const eventId = this.winner().event.id;
    const next = !this.going();
    this.busy.set(true);
    const ok = await this.svc.setGoing(eventId, next);
    this.busy.set(false);
    if (!ok) { this.toast.error('No se pudo guardar. Inténtalo de nuevo.'); return; }
    this.going.set(next);
    const [count, people] = await Promise.all([this.svc.attendeeCount(eventId), this.svc.people(eventId)]);
    this.count.set(count);
    this.people.set(people);
  }

  async send() {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    const error = await this.svc.addComment(this.winner().event.id, text);
    this.sending.set(false);
    if (error) { this.toast.error(error); return; }
    this.draft = '';
    const comments = await this.svc.comments(this.winner().event.id);
    this.comments.set(comments);
    this.commentTotal.set(comments.length);
  }

  canDelete(c: QuedadaComment): boolean {
    const me = this.myId();
    return !!me && (c.user_id === me || this.winner().event.user_id === me);
  }

  async remove(c: QuedadaComment) {
    const ok = await this.confirm.ask({ title: 'Borrar comentario', message: 'No se puede deshacer.', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    if (!(await this.svc.deleteComment(c.id))) { this.toast.error('No se pudo borrar el comentario.'); return; }
    this.comments.update(list => list.filter(x => x.id !== c.id));
    this.commentTotal.update(n => Math.max(0, n - 1));
  }

  routeOf(type: string | null, id: string | null): string[] | null {
    return type && id && PROFILE_ROUTES[type] ? [PROFILE_ROUTES[type], id] : null;
  }
  initial(name: string | null): string { return initialOf(name); }
  color(name: string | null): string { return avatarColor(name ?? '?'); }
  ago(iso: string): string { return timeAgo(iso); }
}
