import {
  ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, InjectionToken, NgZone, OnDestroy, OnInit,
  computed, inject, signal, viewChild,
} from '@angular/core';
import { SeoService } from '../../../core/services/seo.service';
import { A4_DEFAULT, A4_MAX, A4_MIN, Notation, clampA4, midiOctave, noteName } from './note-math';
import { ErrorListener, PitchEngine, ReadingListener, TUNER_ERROR_MESSAGES, TunerErrorCode, WindowMode, mapMediaError } from './pitch-engine';
import { InTuneTracker, PitchSmoother } from './pitch-smoother';
import { TUNER_DESCRIPTION, TUNER_TITLE, TUNER_URL, tunerJsonLd } from './tuner-content';
import { TunerGuideComponent } from './tuner-guide.component';
import { TunerSettings, loadSettings, saveSettings } from './tuner-settings';
import { HINT_LABELS, TunerReadout, computeReadout, formatCents, hintFor, needlePercent } from './tuner-view';
import { TUNINGS, TunerMode, foldOctaveError, isTunerMode, tuningFor } from './tunings';

export interface PitchEngineLike {
  readonly running: boolean;
  start(): Promise<void>;
  stop(): void;
  setWindowMode(mode: WindowMode): void;
}

export const TUNER_ENGINE_FACTORY = new InjectionToken<(onReading: ReadingListener, onError: ErrorListener) => PitchEngineLike>(
  'TUNER_ENGINE_FACTORY',
  { providedIn: 'root', factory: () => (onReading, onError) => new PitchEngine(onReading, onError) },
);

type Status = 'idle' | 'starting' | 'listening';

/** Text/state signals refresh at most this often (the needle moves on every reading). */
const UI_INTERVAL_MS = 50;
/** A note/state must be stable this long before the screen reader announces it. */
const ANNOUNCE_STABLE_MS = 700;

/** Height of the fixed navbar: the tuner card must not hide under it. */
const NAVBAR_PX = 64;

/** /afinador: chromatic and instrument tuner using the microphone. */
@Component({
  selector: 'app-tuner',
  imports: [TunerGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tuner.component.html',
})
export class TunerComponent implements OnInit, OnDestroy {
  private readonly seo = inject(SeoService);
  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly engine: PitchEngineLike;

  readonly tunings = TUNINGS;
  readonly a4Min = A4_MIN;
  readonly a4Max = A4_MAX;
  readonly a4Default = A4_DEFAULT;

  readonly settings = signal<TunerSettings>(loadSettings());
  readonly status = signal<Status>('idle');
  readonly error = signal<TunerErrorCode | null>(null);
  readonly paused = signal(false);
  readonly lockedString = signal<number | null>(null);
  readonly readout = signal<TunerReadout | null>(null);
  readonly live = signal(false);
  readonly inTune = signal(false);
  readonly announcement = signal('');

  readonly tuning = computed(() => tuningFor(this.settings().mode));
  readonly strings = computed(() => {
    const notation = this.settings().notation;
    return this.tuning().strings.map(midi => ({ name: noteName(midi, notation), octave: midiOctave(midi) }));
  });
  readonly errorMessage = computed(() => {
    const code = this.error();
    return code ? TUNER_ERROR_MESSAGES[code] : '';
  });
  readonly hint = computed(() => {
    const r = this.readout();
    return r ? hintFor(r.cents, this.inTune()) : null;
  });
  readonly hintText = computed(() => {
    const h = this.hint();
    return h ? HINT_LABELS[h] : '';
  });
  readonly centsText = computed(() => {
    const r = this.readout();
    return r ? formatCents(r.cents) : '';
  });
  readonly frequencyText = computed(() => {
    const r = this.readout();
    return r ? `${r.frequency.toFixed(1).replace('.', ',')} Hz` : '';
  });

  private readonly needle = viewChild<ElementRef<HTMLElement>>('needle');
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly smoother = new PitchSmoother();
  private readonly tracker = new InTuneTracker();
  private lastUiAt = 0;
  private announceKey = '';
  private pendingKey = '';
  private pendingSince = 0;
  private needleShown: number | null = null;

  private readonly onVisibility = () => {
    if (this.doc.visibilityState === 'hidden') this.pauseIfActive();
  };
  /** iOS may put the page in the back-forward cache without a visibilitychange. */
  private readonly onPageHide = () => this.pauseIfActive();

  constructor() {
    const factory = inject(TUNER_ENGINE_FACTORY);
    this.engine = factory(
      (frequency, now) => this.handleReading(frequency, now),
      code => this.zone.run(() => this.fail(code)),
    );
  }

  ngOnInit(): void {
    this.seo.set({ title: TUNER_TITLE, description: TUNER_DESCRIPTION, url: TUNER_URL });
    this.seo.injectJsonLd(tunerJsonLd());
    this.doc.addEventListener('visibilitychange', this.onVisibility);
    this.doc.defaultView?.addEventListener('pagehide', this.onPageHide);
    this.applyWindowMode();
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('visibilitychange', this.onVisibility);
    this.doc.defaultView?.removeEventListener('pagehide', this.onPageHide);
    this.engine.stop();
  }

  /** Called from the button's click: the engine creates the AudioContext inside this gesture. */
  start(): void {
    if (this.status() !== 'idle') return;
    this.error.set(null);
    this.paused.set(false);
    this.resetReadings();
    this.status.set('starting');
    this.applyWindowMode();
    // The detection loop runs outside Angular; only the capped signal updates reach the view.
    this.zone.runOutsideAngular(() => this.engine.start()).then(
      () => this.zone.run(() => {
        if (this.status() !== 'starting') return;
        this.status.set(this.engine.running ? 'listening' : 'idle');
        this.keepCardVisible();
      }),
      err => this.zone.run(() => this.fail(mapMediaError(err))),
    );
  }

  stop(paused = false): void {
    this.engine.stop();
    this.status.set('idle');
    this.paused.set(paused);
    this.resetReadings();
  }

  private pauseIfActive(): void {
    if (this.status() !== 'idle') this.zone.run(() => this.stop(true));
  }

  /** If the card's top is hidden under the fixed navbar (mobile), bring it back into view. */
  private keepCardVisible(): void {
    const el = this.card()?.nativeElement;
    const win = this.doc.defaultView;
    if (!el || !win) return;
    const top = el.getBoundingClientRect().top;
    if (top < NAVBAR_PX) win.scrollBy({ top: top - NAVBAR_PX - 8, behavior: 'auto' });
  }

  toggle(): void {
    if (this.status() === 'idle') this.start();
    else this.stop();
  }

  setMode(value: string): void {
    if (!isTunerMode(value)) return;
    this.update({ mode: value as TunerMode });
    this.lockedString.set(null);
    this.resetReadings();
    this.applyWindowMode();
  }

  toggleString(index: number): void {
    this.lockedString.update(cur => (cur === index ? null : index));
    this.tracker.reset();
  }

  setNotation(notation: Notation): void {
    this.update({ notation });
    this.refreshReadoutNames();
  }

  stepA4(delta: number): void {
    this.setA4(this.settings().a4 + delta);
  }

  setA4(value: number | string): void {
    const a4 = clampA4(Number(value));
    if (a4 === this.settings().a4) return;
    this.update({ a4 });
    this.tracker.reset();
  }

  stringActive(index: number): boolean {
    return this.readout()?.target?.index === index;
  }

  private update(patch: Partial<TunerSettings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    saveSettings(next);
  }

  private applyWindowMode(): void {
    const t = this.tuning();
    this.engine.setWindowMode(t.bass ? 'long' : t.id === 'chromatic' ? 'auto' : 'short');
  }

  private fail(code: TunerErrorCode): void {
    this.engine.stop();
    this.status.set('idle');
    this.error.set(code);
    this.resetReadings();
  }

  private resetReadings(): void {
    this.smoother.reset();
    this.tracker.reset();
    this.readout.set(null);
    this.live.set(false);
    this.inTune.set(false);
    this.announcement.set('');
    this.announceKey = '';
    this.pendingKey = '';
    this.setNeedle(null);
  }

  /** Runs outside Angular for every detection frame (~40 Hz). */
  private handleReading(raw: number | null, now: number): void {
    const s = this.settings();
    const strings = this.tuning().strings;
    let frequency = raw;
    if (frequency !== null && strings.length && this.live()) {
      const anchor = this.lockedString() ?? this.readout()?.target?.index ?? null;
      frequency = foldOctaveError(frequency, strings, anchor, this.smoother.value, s.a4);
    }
    const smoothed = this.smoother.push(frequency, now);
    if (!smoothed) {
      this.tracker.reset();
      this.setNeedle(null);
      if (this.readout() !== null) {
        this.readout.set(null);
        this.inTune.set(false);
        this.live.set(false);
      }
      return;
    }
    const readout = computeReadout({
      frequency: smoothed.frequency, a4: s.a4, notation: s.notation,
      strings, lockedString: this.lockedString(),
    });
    if (!readout) return;
    // A held (frozen) value must never turn into "Afinada": only live readings count.
    if (!smoothed.live) this.tracker.reset();
    const inTune = smoothed.live && this.tracker.update(readout.cents, now);
    this.setNeedle(readout.cents);

    const prev = this.readout();
    const changedState = inTune !== this.inTune() || smoothed.live !== this.live()
      || prev?.name !== readout.name || prev?.octave !== readout.octave || prev?.target?.index !== readout.target?.index;
    if (changedState || now - this.lastUiAt >= UI_INTERVAL_MS) {
      this.lastUiAt = now;
      this.readout.set(readout);
      this.inTune.set(inTune);
      this.live.set(smoothed.live);
    }
    this.maybeAnnounce(readout, inTune, now);
  }

  /** Screen readers hear the note and state only once it has been stable for a moment. */
  private maybeAnnounce(r: TunerReadout, inTune: boolean, now: number): void {
    const hint = hintFor(r.cents, inTune);
    const key = `${r.name}${r.octave}|${r.target?.index ?? ''}|${hint}`;
    if (key !== this.pendingKey) {
      this.pendingKey = key;
      this.pendingSince = now;
      return;
    }
    if (key === this.announceKey || now - this.pendingSince < ANNOUNCE_STABLE_MS) return;
    this.announceKey = key;
    const target = r.target ? `, cuerda ${r.target.number} ${r.target.name} ${r.target.octave}` : '';
    this.announcement.set(`${r.name} ${r.octave}${target}: ${HINT_LABELS[hint].toLowerCase()}`);
  }

  /** Writes the needle transform straight to the element (compositor-only, no change detection). */
  private setNeedle(cents: number | null): void {
    const el = this.needle()?.nativeElement;
    if (!el) return;
    const pos = cents === null ? null : Math.round(needlePercent(cents) * 10) / 20;
    if (pos === this.needleShown) return;
    this.needleShown = pos;
    el.style.transform = `translateX(${pos ?? 0}%)`;
    el.style.opacity = pos === null ? '0.25' : '1';
  }

  private refreshReadoutNames(): void {
    const r = this.readout();
    if (!r) return;
    const s = this.settings();
    this.readout.set(computeReadout({
      frequency: r.frequency, a4: s.a4, notation: s.notation, strings: this.tuning().strings, lockedString: this.lockedString(),
    }));
  }
}
