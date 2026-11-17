import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SeoService } from '../../core/services/seo.service';
import { ANSWER_PAGE, Answer, MAX_ANSWER_LENGTH, Question, QuestionsService, deadlineLabel, isOpen, monthLabel } from '../../core/services/questions.service';
import { avatarColor, imageSrc, timeAgo } from '../../core/utils/display.utils';
import { shareImage, slugFile } from '../../core/utils/share-card';
import { storyFeedback } from '../../core/utils/story-feedback';
import { initialOf } from '../inbox/profile-avatar';
import { ReportLinkComponent } from '../../shared/components/report-link/report-link.component';
import { renderQuestionCard } from './question-card';

const PROFILE_ROUTES: Readonly<Record<string, string>> = {
  musician: '/musicians', band: '/bands', venue: '/venues', teacher: '/teachers', rehearsal: '/rehearsal',
};
const DRAFT_KEY = 'bandyou_answer_';
const SITE = 'https://www.bandyou.es';

/** "Guitarra · Madrid" under a name. */
export function answerDetail(a: Pick<Answer, 'author_role' | 'author_city'>): string {
  return [a.author_role, a.author_city].map(s => (s ?? '').trim()).filter(Boolean).join(' · ');
}

/** Poster rhythm on the wall: mostly paper, now and then yellow or ink. */
export function cardTone(i: number): 'paper' | 'yellow' | 'ink' {
  if (i % 7 === 3) return 'ink';
  if (i % 5 === 1) return 'yellow';
  return 'paper';
}

function readDraft(id: string): string {
  try { return localStorage.getItem(DRAFT_KEY + id) ?? ''; } catch { return ''; }
}
function writeDraft(id: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(DRAFT_KEY + id, text); else localStorage.removeItem(DRAFT_KEY + id);
  } catch { /* storage blocked */ }
}

/**
 * La pregunta del mes: one question, everyone answers in a few lines, the answers make
 * a wall of quotes. Answering takes one box and one tap; visitors can write first and
 * sign in after (the draft waits). Past questions stay as an archive.
 */
@Component({
  selector: 'app-question-page',
  imports: [RouterLink, FormsModule, ReportLinkComponent],
  templateUrl: './question-page.component.html',
})
export class QuestionPageComponent {
  private svc = inject(QuestionsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly imageSrc = imageSrc;
  readonly max = MAX_ANSWER_LENGTH;
  readonly detail = answerDetail;
  readonly tone = cardTone;
  readonly month = monthLabel;

  private readonly slug = signal<string | null>(null);
  readonly loggedIn = computed(() => this.auth.isLoggedIn());
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  readonly loading = signal(true);
  /** Null: the section is not available (SQL not run or the read failed). */
  readonly questions = signal<Question[] | null>([]);
  /** The question shown: the one in the link, else the open one, else the latest. */
  readonly question = computed<Question | null>(() => {
    const all = this.questions() ?? [];
    const slug = this.slug();
    if (slug) return all.find(q => q.slug === slug) ?? null;
    return all.find(q => isOpen(q)) ?? all[0] ?? null;
  });
  readonly current = computed(() => (this.questions() ?? []).find(q => isOpen(q)) ?? null);
  readonly open = computed(() => { const q = this.question(); return !!q && isOpen(q); });
  readonly archive = computed(() => (this.questions() ?? []).filter(q => q.id !== this.question()?.id));
  readonly deadline = computed(() => { const q = this.question(); return q ? deadlineLabel(q) : ''; });

  readonly answers = signal<Answer[]>([]);
  readonly total = signal(0);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly failed = signal(false);
  readonly mine = signal<Answer | null>(null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly sharing = signal(false);
  /** A draft was waiting for this question (written before signing in, or left half-done). */
  private readonly hadDraft = signal(false);
  readonly restored = computed(() => this.hadDraft() && this.loggedIn() && !this.editing());
  readonly draft = signal('');
  readonly left = computed(() => this.max - this.draft().length);
  /** Signed-in: whether they already answered is known (so the box never flashes for someone who did). */
  readonly mineLoaded = signal(false);
  readonly showComposer = computed(() =>
    this.open() && (this.editing() || (!this.mine() && (!this.loggedIn() || this.mineLoaded()))));
  /** Everyone else's answers (one's own sits apart, on top). */
  readonly others = computed(() => { const m = this.mine(); return m ? this.answers().filter(a => a.id !== m.id) : this.answers(); });

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private readonly mineHeading = viewChild<ElementRef<HTMLElement>>('mineHeading');
  private story: Promise<Blob> | null = null;
  private seq = 0;

  constructor() {
    const sub = this.route.paramMap.subscribe(p => this.slug.set(p.get('slug')));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.loadQuestions();
    // Each question: its answers, the person's own and their draft.
    effect(() => {
      const q = this.question();
      if (!q) return;
      untracked(() => {
        this.setSeo(q);
        void this.loadAnswers(q);
      });
    });
    effect(() => {
      const q = this.question();
      const uid = this.userId();
      untracked(() => void this.loadMine(q, uid));
    });
  }

  private async loadQuestions(): Promise<void> {
    this.loading.set(true);
    this.questions.set(await this.svc.questions());
    this.loading.set(false);
    if (!this.question()) this.seo.set({ title: 'La pregunta del mes · BandYou', description: 'Una pregunta al mes para la gente de la música. Responde en dos líneas y lee lo que cuentan los demás.' });
  }

  private setSeo(q: Question): void {
    this.seo.set({
      title: `${q.title} · La pregunta del mes · BandYou`,
      description: q.intro ? `${q.intro} Responde en BandYou y lee lo que cuentan otros músicos.` : 'Responde en BandYou y lee lo que cuentan otros músicos.',
      type: 'website',
    });
  }

  private async loadAnswers(q: Question): Promise<void> {
    const seq = ++this.seq;
    this.failed.set(false);
    this.answers.set([]);
    this.total.set(0);
    this.editing.set(false);
    this.draft.set(readDraft(q.id));
    this.hadDraft.set(!!this.draft());
    const page = await this.svc.answers(q.id);
    if (seq !== this.seq) return;
    if (!page) { this.failed.set(true); return; }
    this.answers.set(page.rows);
    this.total.set(page.total ?? page.rows.length);
    this.hasMore.set(page.rows.length === ANSWER_PAGE);
  }

  private async loadMine(q: Question | null, uid: string | null): Promise<void> {
    this.mine.set(null);
    this.mineLoaded.set(false);
    this.story = null;
    if (!q || !uid) return;
    const mine = await this.svc.mine(q.id, uid);
    if (this.question()?.id === q.id && this.userId() === uid) {
      this.mine.set(mine);
      this.mineLoaded.set(true);
      if (mine) this.prepareStory();
    }
  }

  async more(): Promise<void> {
    const q = this.question();
    const last = this.answers().at(-1);
    if (!q || !last || this.loadingMore()) return;
    this.loadingMore.set(true);
    const next = await this.svc.answers(q.id, last.created_at);
    this.loadingMore.set(false);
    if (!next) { this.toast.error('No se pudieron cargar más respuestas.'); return; }
    const seen = new Set(this.answers().map(a => a.id));
    this.answers.update(list => [...list, ...next.rows.filter(a => !seen.has(a.id))]);
    this.hasMore.set(next.rows.length === ANSWER_PAGE);
  }

  retry(): void {
    const q = this.question();
    if (q) void this.loadAnswers(q);
  }

  onDraft(text: string): void {
    this.draft.set(text);
    // An edit of a published answer is not a draft: nothing to keep if it is abandoned.
    const q = this.question();
    if (q && !this.editing()) writeDraft(q.id, text);
  }

  /** "Llegamos a la sala y…" → the box starts with those words, cursor at the end. */
  useStarter(starter: string): void {
    const words = starter.replace(/…$/, '').trimEnd() + ' ';
    const current = this.draft().trim();
    this.onDraft(current ? `${current} ${words}` : words);
    const el = this.box()?.nativeElement;
    if (!el) return;
    el.focus();
    queueMicrotask(() => el.setSelectionRange(el.value.length, el.value.length));
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void this.publish();
    }
  }

  async publish(): Promise<void> {
    const q = this.question();
    if (!q || this.saving()) return;
    if (!this.draft().trim()) {
      this.box()?.nativeElement.focus();
      return;
    }
    // Visitors write first; the draft waits while they sign in and comes back here.
    if (!this.loggedIn()) {
      writeDraft(q.id, this.draft());
      void this.router.navigate(['/auth/login']);
      return;
    }
    this.saving.set(true);
    const result = await this.svc.save(q.id, this.draft(), this.mine()?.id);
    this.saving.set(false);
    if (typeof result === 'string') { this.toast.error(result); return; }
    const isNew = !this.mine();
    this.mine.set(result);
    this.editing.set(false);
    this.hadDraft.set(false);
    this.draft.set('');
    writeDraft(q.id, '');
    this.answers.update(list => [result, ...list.filter(a => a.id !== result.id)]);
    if (isNew) this.total.update(n => n + 1);
    this.story = null;
    this.prepareStory();
    this.toast.success(isNew ? '¡Respuesta publicada! Compártela en tus historias.' : 'Respuesta actualizada.');
    // The box is gone: focus goes to the published answer.
    setTimeout(() => this.mineHeading()?.nativeElement.focus());
  }

  edit(): void {
    const m = this.mine();
    if (!m) return;
    this.draft.set(m.text);
    this.editing.set(true);
    setTimeout(() => this.box()?.nativeElement.focus());
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.draft.set('');
  }

  async remove(): Promise<void> {
    const m = this.mine();
    if (!m) return;
    const ok = await this.confirm.ask({ title: 'Borrar tu respuesta', message: 'Desaparece de la pregunta. Puedes volver a responder mientras siga abierta.', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    if (!(await this.svc.remove(m.id))) { this.toast.error('No se pudo borrar. Inténtalo otra vez.'); return; }
    this.mine.set(null);
    this.answers.update(list => list.filter(a => a.id !== m.id));
    this.total.update(n => Math.max(0, n - 1));
    this.story = null;
  }

  /** Renders the story image while idle, so the tap can open the share sheet at once (Safari). */
  private prepareStory(): void {
    if (this.story || typeof window === 'undefined') return;
    const run = () => { if (!this.story) this.story = this.renderStory(); this.story.catch(() => { this.story = null; }); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(run); else setTimeout(run, 300);
  }

  private renderStory(): Promise<Blob> {
    const q = this.question();
    const m = this.mine();
    if (!q || !m) return Promise.reject(new Error('Nothing to draw'));
    return renderQuestionCard({ question: q.title, answer: m.text, name: m.author_name || 'Yo', detail: answerDetail(m) });
  }

  async shareStory(): Promise<void> {
    const q = this.question();
    if (!q || this.sharing()) return;
    this.sharing.set(true);
    try {
      this.story ??= this.renderStory();
      const blob = await this.story;
      storyFeedback(await shareImage(blob, slugFile(`pregunta ${q.slug}`), `${SITE}/pregunta`), this.toast);
    } catch {
      this.story = null;
      this.toast.error('No se pudo crear la imagen.');
    } finally {
      this.sharing.set(false);
    }
  }

  /** Pass the question on: share sheet on phones, copied link elsewhere. */
  async invite(): Promise<void> {
    const q = this.question();
    if (!q) return;
    const url = `${SITE}/pregunta`;
    const text = `${q.title} Contesta en BandYou:`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: q.title, text, url }); } catch { /* closed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.toast.success('Enlace copiado. Pásaselo a quien quieras.');
    } catch {
      this.toast.error('No se pudo copiar el enlace.');
    }
  }

  routeOf(a: Answer): string[] | null {
    const base = a.author_profile_type ? PROFILE_ROUTES[a.author_profile_type] : null;
    return base && a.author_profile_id ? [base, a.author_profile_id] : null;
  }
  color(name: string | null): string { return avatarColor(name); }
  initial(name: string | null): string { return initialOf(name); }
  ago(iso: string): string { return timeAgo(iso); }
}
