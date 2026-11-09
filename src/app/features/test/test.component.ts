import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SITE_URL, SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { shareImage } from '../../core/utils/share-card';
import { storyFeedback } from '../../core/utils/story-feedback';
import { QUESTIONS, TEST_INSTRUMENTS, TYPES, TypeId, URGENT_MS } from './test-data';
import { addAnswer, compat, emptyScores, isTypeId, winner } from './test-logic';
import { renderTestCard } from './test-card';

type Phase = 'intro' | 'instrument' | 'question' | 'loading' | 'result';

/** Pause on each answer so its reaction can be read. */
const REACTION_MS = 1500;
const LOADING_MS = 2100;
const LOADING_LINES = ['Revisando la grabación del bolo…', 'Preguntando al técnico de sonido…', 'Leyendo el grupo de WhatsApp…'];

/** /test — "¿Qué músico de banda eres?": a gig day in nine choices, made for Instagram. */
@Component({
  selector: 'app-test',
  imports: [RouterLink, LowerCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test.component.html',
  styleUrl: './test.component.css',
})
export class TestComponent implements OnInit {
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private story: Promise<Blob> | null = null;
  private storyReady: Blob | null = null;

  readonly types = TYPES;
  readonly questions = QUESTIONS;
  readonly instruments = TEST_INSTRUMENTS;
  readonly letters = 'ABCD';

  readonly phase = signal<Phase>('intro');
  readonly step = signal(0);
  readonly instrument = signal<readonly [string, string] | null>(null);
  readonly picked = signal<number | null>(null);
  readonly reaction = signal<string | null>(null);
  readonly timeLeft = signal(1);
  readonly loadingLine = signal(LOADING_LINES[0]);
  readonly result = signal<TypeId | null>(null);
  readonly barsOn = signal(false);
  readonly making = signal(false);
  readonly vs = signal<TypeId | null>(null);
  private scores = emptyScores();
  private last: TypeId | null = null;

  readonly question = computed(() => QUESTIONS[this.step()]);
  readonly type = computed(() => { const id = this.result(); return id ? TYPES[id] : null; });
  readonly duel = computed(() => { const a = this.result(), b = this.vs(); return a && b ? compat(a, b) : null; });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  ngOnInit() {
    const vs = this.route.snapshot.queryParamMap.get('vs');
    this.vs.set(isTypeId(vs) ? vs : null);
    const rival = this.vs();
    this.seo.set({
      title: rival ? `¿Encajas con «${TYPES[rival].name}»? Test de banda` : '¿Qué músico de banda eres? Test',
      description: 'Un día de bolo en nueve decisiones, de la prueba de sonido al grupo de WhatsApp. Descubre qué músico eres en tu banda y con quién encajas. Gratis y sin cuenta.',
      url: `${SITE_URL}/test`,
      image: `${SITE_URL}/test/og${rival ? '-' + rival : ''}.png`,
    });
  }

  typeImage(id: TypeId): string { return `/test/types/${id}.webp`; }
  instrumentImage(key: string): string { return `/instruments/${key}.webp`; }
  isDone(i: number): boolean { return i < this.step(); }

  start() { this.phase.set('instrument'); }

  chooseInstrument(inst: readonly [string, string]) {
    this.instrument.set(inst);
    this.scores = emptyScores();
    this.last = null;
    this.step.set(0);
    this.showQuestion();
  }

  pick(i: number) {
    if (this.picked() !== null) return;
    this.stopTicker();
    const answer = this.question().a[i];
    this.scores = addAnswer(this.scores, answer);
    this.last = answer[1][0];
    this.picked.set(i);
    this.reaction.set(answer[2]);
    this.later(() => this.next(), REACTION_MS);
  }

  share = async () => {
    if (this.making()) return;
    this.making.set(true);
    try {
      const blob = this.storyReady ?? await this.renderStory();
      storyFeedback(await shareImage(blob, `bandyou-test-${this.result()}.png`, this.dareLink()), this.toast);
    } catch {
      this.toast.error('No se pudo crear la imagen.');
    } finally {
      this.making.set(false);
    }
  };

  async dare() {
    const id = this.result();
    if (!id) return;
    const url = this.dareLink();
    const text = `Me ha salido «${TYPES[id].name}». ¿Y a ti? A ver si encajamos en la banda:`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text, url }); return; } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.toast.success('Enlace copiado. Pásaselo a tu banda.');
    } catch {
      this.toast.error(`No se pudo copiar. El enlace es ${url}`);
    }
  }

  restart() {
    this.stopTimers();
    this.result.set(null);
    this.story = null;
    this.storyReady = null;
    this.barsOn.set(false);
    this.phase.set('instrument');
  }

  private dareLink(): string { return `${SITE_URL}/test?vs=${this.result()}`; }

  private showQuestion() {
    this.picked.set(null);
    this.reaction.set(null);
    this.phase.set('question');
    if (this.question().urgent) this.startClock();
  }

  private next() {
    if (this.step() + 1 < QUESTIONS.length) {
      this.step.update(s => s + 1);
      this.showQuestion();
    } else {
      this.finish();
    }
  }

  private startClock() {
    const begin = Date.now();
    this.timeLeft.set(1);
    this.ticker = setInterval(() => {
      const left = Math.max(0, URGENT_MS - (Date.now() - begin));
      this.timeLeft.set(left / URGENT_MS);
      if (left === 0) this.timeUp();
    }, 50);
  }

  private timeUp() {
    this.stopTicker();
    if (this.picked() !== null) return;
    this.picked.set(-1);
    this.reaction.set(this.question().timeout ?? '¡Tiempo!');
    navigator.vibrate?.(120);
    this.later(() => this.next(), REACTION_MS);
  }

  private finish() {
    this.phase.set('loading');
    let n = 0;
    this.ticker = setInterval(() => this.loadingLine.set(LOADING_LINES[++n % LOADING_LINES.length]), 700);
    this.later(() => {
      this.stopTicker();
      this.result.set(winner(this.scores, this.last));
      this.phase.set('result');
      window.scrollTo({ top: 0 });
      this.later(() => this.barsOn.set(true), 250);
      // Ready before the tap: Safari only opens the share sheet right after one.
      this.later(() => { this.renderStory().catch(() => undefined); }, 600);
    }, LOADING_MS);
  }

  private renderStory(): Promise<Blob> {
    const id = this.result(), inst = this.instrument();
    if (!id || !inst) return Promise.reject(new Error('No result yet'));
    const t = TYPES[id];
    this.story ??= renderTestCard({
      type: t, instrument: inst[1], typeImage: this.typeImage(id),
      fitsName: TYPES[t.fits].name, clashName: t.clash ? TYPES[t.clash].name : 'Nadie (y a veces es un problema)',
    }).then(b => (this.storyReady = b));
    this.story.catch(() => { this.story = null; });
    return this.story;
  }

  private later(fn: () => void, ms: number) { this.timers.push(setTimeout(fn, ms)); }
  private stopTicker() { if (this.ticker) clearInterval(this.ticker); this.ticker = null; }
  private stopTimers() { this.stopTicker(); this.timers.forEach(clearTimeout); this.timers = []; }
}
