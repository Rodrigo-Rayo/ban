import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AppComment, CommentsService, CommentTarget, CommentTargetType, MAX_COMMENT_LENGTH } from '../../../core/services/comments.service';
import { avatarColor, timeAgo } from '../../../core/utils/display.utils';
import { initialOf } from '../../../features/inbox/profile-avatar';

const PROFILE_ROUTES: Readonly<Record<string, string>> = {
  musician: '/musicians', band: '/bands', venue: '/venues', teacher: '/teachers', rehearsal: '/rehearsal',
};

/**
 * Comment thread under a Se busca post or an Agenda event. Signed-in users read and
 * write; visitors see how many there are. Hidden until supabase/2026_10_comments.sql runs.
 */
@Component({
  selector: 'app-comments',
  imports: [RouterLink, FormsModule],
  template: `
    @if (total() !== null) {
      <section [attr.aria-labelledby]="headingId()">
        <h2 [id]="headingId()" class="font-display text-2xl leading-none border-t border-dark-600 pt-3 mb-1">
          Comentarios <span class="font-mono text-sm text-ink-muted align-middle" aria-live="polite">({{ total() }})</span>
        </h2>
        @if (loggedIn()) {
          <ul class="flex flex-col">
            @for (c of comments(); track c.id) {
              <li class="flex gap-3 py-3 border-b border-ink/15">
                <span class="avatar w-10 h-10 text-sm border-2 border-ink overflow-hidden flex-shrink-0"
                      [style.background]="c.author_avatar ? null : color(c.author_name)" aria-hidden="true">
                  @if (c.author_avatar) { <img [src]="c.author_avatar" alt="" class="w-full h-full object-cover" loading="lazy"/> } @else { {{ initial(c.author_name) }} }
                </span>
                <div class="min-w-0 flex-1">
                  <p class="flex items-baseline gap-2 flex-wrap">
                    @if (routeOf(c); as route) {
                      <a [routerLink]="route" class="font-bold text-sm hover:text-primary-600">{{ c.author_name || 'Usuario' }}</a>
                    } @else {
                      <span class="font-bold text-sm">{{ c.author_name || 'Usuario' }}</span>
                    }
                    @if (c.user_id === ownerId()) { <span class="tag-accent text-[10px]">{{ ownerLabel() }}</span> }
                    <span class="meta">{{ ago(c.created_at) }}</span>
                  </p>
                  <p class="text-[15px] leading-relaxed mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]">{{ c.text }}</p>
                </div>
                @if (canDelete(c)) {
                  <button type="button" (click)="remove(c)"
                    class="font-mono text-[11px] font-bold uppercase text-ink-muted hover:text-signal-red min-h-[44px] px-2 self-start"
                    [attr.aria-label]="'Borrar comentario de ' + (c.author_name || 'usuario')">Borrar</button>
                }
              </li>
            } @empty {
              @if (failed()) {
                <li class="text-sm py-3">No se pudieron cargar los comentarios.
                  <button type="button" (click)="retry()" class="font-bold underline underline-offset-2 hover:text-primary-600 min-h-[44px]">Reintentar</button>
                </li>
              } @else if (total() === 0) {
                <li class="text-sm text-ink-muted py-3">{{ emptyText() }}</li>
              }
            }
          </ul>
          <form (ngSubmit)="send()" class="mt-4">
            <label [for]="inputId()" class="sr-only">Escribe un comentario</label>
            <textarea [id]="inputId()" name="comment" [(ngModel)]="draft" rows="2" [maxlength]="max"
              [placeholder]="placeholder()" class="input-field resize-none"></textarea>
            <div class="flex items-center justify-between gap-3 mt-2">
              <span class="font-mono text-[11px] text-ink-muted">{{ draft.length }}/{{ max }}</span>
              <button type="submit" [disabled]="sending() || !draft.trim()" class="btn-night min-h-[44px] px-6 text-xs disabled:opacity-50">
                {{ sending() ? 'Publicando…' : 'Publicar' }}
              </button>
            </div>
          </form>
        } @else {
          <p class="text-sm mt-3">
            @if (total()) {
              {{ total() === 1 ? 'Hay 1 comentario.' : 'Hay ' + total() + ' comentarios.' }}
              <a routerLink="/auth/login" class="font-bold underline underline-offset-2 hover:text-primary-600">Entra</a> para leerlos y comentar.
            } @else {
              Todavía no hay comentarios. <a routerLink="/auth/login" class="font-bold underline underline-offset-2 hover:text-primary-600">Entra</a> para comentar.
            }
          </p>
        }
      </section>
    }
  `,
})
export class CommentsComponent {
  private svc = inject(CommentsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly targetType = input.required<CommentTargetType>();
  readonly targetId = input.required<string>();
  /** user_id of whoever published the post or event: tagged in the thread and can delete comments. */
  readonly ownerId = input<string | null>(null);

  readonly max = MAX_COMMENT_LENGTH;
  readonly loggedIn = computed(() => this.auth.isLoggedIn());
  readonly total = signal<number | null>(null);
  readonly comments = signal<AppComment[]>([]);
  readonly sending = signal(false);
  /** Signed in and the thread is not empty (not the exact count: 3 → 2 must not refetch). */
  private readonly shouldList = computed(() => this.loggedIn() && (this.total() ?? 0) > 0);
  /** The list could not be read (the count could). */
  readonly failed = signal(false);
  readonly headingId = computed(() => `comments-title-${this.targetType()}`);
  readonly inputId = computed(() => `comment-input-${this.targetType()}`);
  readonly ownerLabel = computed(() => this.targetType() === 'post' ? 'Anunciante' : 'Organiza');
  readonly emptyText = computed(() => this.targetType() === 'post'
    ? 'Nadie ha comentado todavía. ¿Dudas sobre el anuncio? Pregunta aquí.'
    : 'Nadie ha comentado todavía. ¿Vas a ir? ¿Con quién? Rompe el hielo.');
  readonly placeholder = computed(() => this.targetType() === 'post'
    ? 'Pregunta o comenta algo sobre el anuncio…'
    : '¿Vas a ir? ¿Alguien de tu zona para ir juntos?');
  draft = '';
  /** Bumped on every target change: answers for an older target are dropped. */
  private seq = 0;

  constructor() {
    // A new post or event (the page reuses this component when moving between them): start clean.
    effect(() => {
      const target = { type: this.targetType(), id: this.targetId() };
      const seq = ++this.seq;
      this.total.set(null);
      this.comments.set([]);
      this.failed.set(false);
      this.draft = '';
      void this.svc.count(target).then(n => { if (seq === this.seq) this.total.set(n); });
    });
    // The thread itself, once signed in and there is something to read.
    effect(() => { if (this.shouldList()) untracked(() => void this.loadList(this.seq)); });
  }

  private target(): CommentTarget {
    return { type: this.targetType(), id: this.targetId() };
  }

  private async loadList(seq: number) {
    const list = await this.svc.list(this.target());
    if (seq !== this.seq) return;
    this.failed.set(list === null);
    if (list) this.comments.set(list);
  }

  retry() { void this.loadList(this.seq); }

  async send() {
    if (this.sending() || !this.draft.trim()) return;
    const seq = this.seq;
    const target = this.target();
    this.sending.set(true);
    const error = await this.svc.add(target, this.draft);
    if (seq !== this.seq) { this.sending.set(false); return; }
    if (error) {
      this.sending.set(false);
      this.toast.error(error);
      return;
    }
    this.draft = '';
    const wasListing = this.shouldList();
    const total = await this.svc.count(target);
    this.sending.set(false);
    if (seq !== this.seq) return;
    this.total.set(total ?? (this.total() ?? 0) + 1);
    // From 0 to 1 the effect loads the thread; otherwise reload it here.
    if (wasListing) await this.loadList(seq);
  }

  canDelete(c: AppComment): boolean {
    const me = this.auth.user()?.id;
    return !!me && (c.user_id === me || this.ownerId() === me);
  }

  async remove(c: AppComment) {
    const ok = await this.confirm.ask({ title: 'Borrar comentario', message: 'No se puede deshacer.', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    const seq = this.seq;
    if (!(await this.svc.remove(c.id))) { this.toast.error('No se pudo borrar el comentario.'); return; }
    if (seq !== this.seq) return;
    this.comments.update(list => list.filter(x => x.id !== c.id));
    this.total.update(n => n === null ? null : Math.max(0, n - 1));
  }

  routeOf(c: AppComment): string[] | null {
    const base = c.author_profile_type && Object.hasOwn(PROFILE_ROUTES, c.author_profile_type) ? PROFILE_ROUTES[c.author_profile_type] : undefined;
    return base && c.author_profile_id ? [base, c.author_profile_id] : null;
  }
  initial(name: string | null): string { return initialOf(name); }
  color(name: string | null): string { return avatarColor(name ?? '?'); }
  ago(iso: string): string { return timeAgo(iso); }
}
