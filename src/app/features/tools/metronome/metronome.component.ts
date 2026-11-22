import {
  ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, InjectionToken, NgZone, OnInit, computed, inject, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_URL, SeoService } from '../../../core/services/seo.service';
import { EngineDeps, MetronomeEngine } from './metronome-engine';
import {
  BPM_MAX, BPM_MIN, METERS, MeterId, MetronomeSettings, SOUNDS, SUBDIVISIONS, SoundId, Subdivision, TEMPO_TABLE,
  clampBpm, groupStarts, isCompound, loadSettings, meterById, saveSettings, tempoName,
} from './metronome-model';
import { TapTempo } from './tap-tempo';
import { FAQS, PRACTICE_TIPS, metronomeJsonLd } from './metronome-content';

/** Lets tests swap the AudioContext, timers and visibility for fakes. */
export const METRONOME_DEPS = new InjectionToken<Partial<EngineDeps>>('METRONOME_DEPS');

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 70;
const ANNOUNCE_DELAY_MS = 700;

interface WakeLockLike { release(): Promise<void> }

/** /metronomo — free online metronome, also an SEO landing page. */
@Component({
  selector: 'app-metronome',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metronome.component.html',
  styleUrl: './metronome.component.css',
  host: {
    '(document:keydown)': 'onKeyDown($event)',
    '(document:keyup)': 'onKeyUp($event)',
    '(document:visibilitychange)': 'onVisibility()',
  },
})
export class MetronomeComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly storage = safeStorage();
  private readonly engine: MetronomeEngine;
  private readonly tapper = new TapTempo();
  private raf: number | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdRepeat: ReturnType<typeof setInterval> | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeLock: WakeLockLike | null = null;

  readonly BPM_MIN = BPM_MIN;
  readonly BPM_MAX = BPM_MAX;
  readonly meters = METERS;
  readonly subdivisions = SUBDIVISIONS;
  readonly sounds = SOUNDS;
  readonly tempoTable = TEMPO_TABLE;
  readonly tips = PRACTICE_TIPS;
  readonly faqs = FAQS;

  readonly settings = signal<MetronomeSettings>(loadSettings(this.storage));
  readonly playing = signal(false);
  readonly unsupported = signal(false);
  readonly activePulse = signal(-1);
  readonly announcement = signal('');
  readonly tapCount = signal(0);

  readonly meter = computed(() => meterById(this.settings().meter));
  readonly compound = computed(() => isCompound(this.meter()));
  readonly tempo = computed(() => tempoName(this.settings().bpm));
  readonly volumePct = computed(() => Math.round(this.settings().volume * 100));
  readonly pulses = computed(() => {
    const m = this.meter();
    const starts = groupStarts(m);
    return Array.from({ length: m.pulses }, (_, i) => ({ i, strong: m.groups ? starts.includes(i) : true }));
  });

  constructor() {
    this.engine = new MetronomeEngine(this.settings(), inject(METRONOME_DEPS, { optional: true }) ?? {});
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  ngOnInit(): void {
    this.seo.set({
      title: 'Metrónomo online gratis',
      description: 'Metrónomo online gratis y preciso: de 30 a 300 BPM, compases 2/4 a 12/8, corcheas, tresillos, acento y marcar tempo. Funciona en el móvil, sin registrarte.',
      url: `${SITE_URL}/metronomo`,
    });
    this.seo.injectJsonLd(metronomeJsonLd());
  }

  // ── transport ──

  toggle(): void {
    if (this.playing()) {
      this.engine.stop();
      this.playing.set(false);
      this.stopVisuals();
      this.releaseWakeLock();
      return;
    }
    if (!this.engine.start()) {
      this.unsupported.set(true);
      return;
    }
    this.playing.set(true);
    this.startVisuals();
    void this.requestWakeLock();
  }

  // ── settings ──

  setBpm(value: number): void {
    const bpm = clampBpm(value);
    if (bpm === this.settings().bpm) return;
    this.apply({ bpm });
    this.scheduleAnnouncement();
  }

  nudge(delta: number): void {
    this.setBpm(this.settings().bpm + delta);
  }

  onSlider(event: Event): void {
    this.setBpm(Number((event.target as HTMLInputElement).value));
  }

  setMeter(id: string): void { this.apply({ meter: id as MeterId }); }
  setSubdivision(value: string): void { this.apply({ subdivision: Number(value) as Subdivision }); }
  setSound(id: string): void { this.apply({ sound: id as SoundId }); }
  setVolume(event: Event): void { this.apply({ volume: Number((event.target as HTMLInputElement).value) / 100 }); }
  toggleAccent(): void { this.apply({ accent: !this.settings().accent }); }

  tap(): void {
    const bpm = this.tapper.tap(performance.now());
    this.tapCount.set(this.tapper.count + 1);
    if (bpm !== null) this.setBpm(bpm);
  }

  private apply(patch: Partial<MetronomeSettings>): void {
    this.engine.update(patch);
    // The engine sanitizes; mirror its result so UI and sound never disagree.
    this.settings.set(this.engine.settings);
    saveSettings(this.storage, this.engine.settings);
  }

  private scheduleAnnouncement(): void {
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announcement.set(`${this.settings().bpm} BPM, ${this.tempo()}`);
    }, ANNOUNCE_DELAY_MS);
  }

  // ── − / + : press and hold to repeat ──

  holdStart(delta: number, event: PointerEvent): void {
    if (event.button !== 0) return;
    this.holdEnd();
    this.nudge(delta);
    this.holdTimer = setTimeout(() => {
      this.holdRepeat = setInterval(() => this.nudge(delta), HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }

  holdEnd(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.holdRepeat) clearInterval(this.holdRepeat);
    this.holdTimer = null;
    this.holdRepeat = null;
  }

  /** Keyboard activation (Enter/Space on the button) arrives as a click with detail 0; pointer clicks were handled on pointerdown. */
  stepClick(delta: number, event: MouseEvent): void {
    if (event.detail === 0) this.nudge(delta);
  }

  // ── keyboard shortcuts ──

  onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const onRange = isRange(e.target);
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        if (!e.repeat) this.toggle();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        if (onRange) return; // the focused slider moves itself
        e.preventDefault();
        this.nudge({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: 5, ArrowDown: -5 }[e.key]);
        return;
      case 't':
      case 'T':
        if (!e.repeat) this.tap();
        return;
    }
  }

  /** Stops a focused button from also "clicking" on Space release. */
  onKeyUp(e: KeyboardEvent): void {
    if ((e.key === ' ' || e.key === 'Spacebar') && !isTyping(e.target)) e.preventDefault();
  }

  onVisibility(): void {
    this.engine.wake();
    if (this.playing() && !this.doc.hidden) void this.requestWakeLock();
  }

  // ── beat lights: rAF outside Angular, signal touched only when the beat changes ──

  private startVisuals(): void {
    if (this.raf !== null || typeof requestAnimationFrame === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      const frame = () => {
        this.raf = requestAnimationFrame(frame);
        const pulse = this.engine.current()?.pulse ?? -1;
        if (pulse !== this.activePulse()) this.zone.run(() => this.activePulse.set(pulse));
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  private stopVisuals(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.activePulse.set(-1);
  }

  // ── screen wake lock (best effort) ──

  private async requestWakeLock(): Promise<void> {
    const api = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<WakeLockLike> } }).wakeLock;
    if (!api || this.wakeLock) return;
    try {
      const lock = await api.request('screen');
      if (this.playing()) this.wakeLock = lock;
      else lock.release().catch(() => undefined);
    } catch { /* denied or unsupported: the metronome keeps playing */ }
  }

  private releaseWakeLock(): void {
    const lock = this.wakeLock;
    this.wakeLock = null;
    lock?.release().catch(() => undefined);
  }

  private teardown(): void {
    this.engine.destroy();
    this.stopVisuals();
    this.holdEnd();
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.releaseWakeLock();
    this.doc.getElementById('ld-json')?.remove();
  }
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return !['range', 'checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type);
}

function isRange(target: EventTarget | null): boolean {
  const el = target as HTMLInputElement | null;
  return !!el && el.tagName === 'INPUT' && el.type === 'range';
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
