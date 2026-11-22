import {
  ClickLevel, DEFAULT_SETTINGS, MetronomeSettings, SoundId,
  effectiveSubdivision, levelForStep, meterById, pulseForStep, sanitizeSettings, secondsPerStep, stepsPerBar,
} from './metronome-model';

/*
 * Metronome engine — "A Tale of Two Clocks" lookahead scheduling.
 *
 * A coarse JS timer only *plans*: every TICK_MS it books every click that falls inside the
 * next AHEAD_S seconds at an exact AudioContext time (osc.start(when) is sample-accurate).
 * The click time accumulates (nextTime += step) and is never re-derived from a wall clock,
 * so there is no drift. The window is generous (0.4 s; 2 s while the tab is hidden, where
 * timers are throttled to ~1 s) so a busy main thread never makes a click late. Booked
 * clicks that have not played yet are cancelled and re-booked whenever a setting changes,
 * so tempo/compás/sound changes still apply from the very next click.
 */

/** How often the planner wakes up. */
export const TICK_MS = 25;
/** Schedule-ahead window while the page is visible. */
export const AHEAD_S = 0.4;
/** Schedule-ahead window while the tab is hidden (background timers fire ~once per second). */
export const HIDDEN_AHEAD_S = 2;
/** Clicks closer than this to "now" are left alone when re-booking (the audio thread may own them). */
export const CANCEL_MARGIN_S = 0.025;
/** First click lands this long after Start, so it is never booked in the past. */
export const START_DELAY_S = 0.06;
/** If the planner ever falls further behind than this (frozen tab), it re-aligns instead of bursting. */
export const LATE_TOLERANCE_S = 0.02;

// ── Minimal structural types, so tests can pass a fake AudioContext ──
export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  setTargetAtTime(v: number, t: number, c: number): unknown;
}
export interface NodeLike {
  connect(dest: unknown): unknown;
  disconnect(): void;
}
export interface OscillatorLike extends NodeLike {
  type: OscillatorType;
  frequency: ParamLike;
  onended: (() => void) | null;
  start(when: number): void;
  stop(when: number): void;
}
export interface GainLike extends NodeLike {
  gain: ParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  readonly outputLatency?: number;
  readonly baseLatency?: number;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBuffer?(channels: number, length: number, rate: number): unknown;
  createBufferSource?(): { buffer: unknown; connect(d: unknown): unknown; start(when: number): void };
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface EngineDeps {
  createContext: () => AudioContextLike | null;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  isHidden: () => boolean;
}

export interface ScheduledClick {
  time: number;
  step: number;
  pulse: number;
  level: ClickLevel;
  /** Step length the click was booked with (needed to re-align after a structural change). */
  stepDur: number;
  /** Subdivision in force when booked. */
  subs: number;
}

interface Booked extends ScheduledClick {
  osc: OscillatorLike | null;
  gain: GainLike | null;
}

interface Voice { type: OscillatorType; freq: number; endFreq: number | null; gain: number; decay: number }

/** Synthesized voices: no samples to download. */
export const VOICES: Record<SoundId, Record<ClickLevel, Voice>> = {
  click: {
    accent: { type: 'triangle', freq: 1800, endFreq: null, gain: 1, decay: 0.035 },
    beat: { type: 'triangle', freq: 1200, endFreq: null, gain: 0.8, decay: 0.035 },
    sub: { type: 'triangle', freq: 1200, endFreq: null, gain: 0.35, decay: 0.025 },
  },
  wood: {
    accent: { type: 'sine', freq: 1250, endFreq: 900, gain: 1, decay: 0.07 },
    beat: { type: 'sine', freq: 900, endFreq: 650, gain: 0.85, decay: 0.06 },
    sub: { type: 'sine', freq: 900, endFreq: 650, gain: 0.4, decay: 0.045 },
  },
};

const ATTACK_S = 0.001;
const SILENT = 0.0001;

export function defaultDeps(): EngineDeps {
  return {
    createContext: createBrowserContext,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
    isHidden: () => typeof document !== 'undefined' && document.hidden,
  };
}

function createBrowserContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    // iOS: play through the ring/silent switch like a media app (Safari 16.4+).
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch { /* not supported */ }
  try {
    return new Ctor({ latencyHint: 'interactive' }) as unknown as AudioContextLike;
  } catch {
    return null;
  }
}

/** Perceived loudness is roughly logarithmic: square the slider. */
export function volumeToGain(volume: number): number {
  return volume * volume;
}

export class MetronomeEngine {
  private readonly deps: EngineDeps;
  private ctx: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private primed = false;
  private timer: unknown = null;
  private playing = false;
  private nextTime = 0;
  private step = 0;
  private queue: Booked[] = [];
  private s: MetronomeSettings;

  constructor(settings: Partial<MetronomeSettings> = {}, deps: Partial<EngineDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
    this.s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...settings });
  }

  get settings(): MetronomeSettings { return this.s; }
  get isPlaying(): boolean { return this.playing; }
  get context(): AudioContextLike | null { return this.ctx; }

  /** Clicks booked and not yet pruned (for tests and the visual queue). */
  get scheduled(): readonly ScheduledClick[] {
    return this.queue.map(({ osc: _o, gain: _g, ...c }) => c);
  }

  /**
   * Starts playing. Must be called from a user gesture (tap/key): that is when browsers,
   * iOS above all, allow the AudioContext to start. Returns false if Web Audio is missing.
   */
  start(): boolean {
    if (this.playing) return true;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    this.resumeContext();
    this.prime(ctx);
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + START_DELAY_S;
    this.tick();
    return true;
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) this.deps.clearTimeout(this.timer);
    this.timer = null;
    const now = this.ctx?.currentTime ?? 0;
    this.queue.filter(c => c.time > now).forEach(c => this.silence(c));
    this.queue = [];
  }

  toggle(): boolean {
    if (this.playing) { this.stop(); return false; }
    return this.start();
  }

  /** Applies new settings; while playing they take effect from the next click. */
  update(patch: Partial<MetronomeSettings>): void {
    const prev = this.s;
    const next = sanitizeSettings({ ...prev, ...patch });
    this.s = next;
    if (next.volume !== prev.volume && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(volumeToGain(next.volume), this.ctx.currentTime, 0.01);
    }
    if (!this.playing) return;
    const structural = next.meter !== prev.meter || next.subdivision !== prev.subdivision;
    const timing = structural || next.bpm !== prev.bpm || next.accent !== prev.accent || next.sound !== prev.sound;
    if (timing) this.rebook(structural, prev);
  }

  /** Called when the tab becomes visible/hidden: refill with the right window, resume if iOS paused us. */
  wake(): void {
    if (!this.playing) return;
    this.resumeContext();
    this.fill();
  }

  /** The click currently being heard (output latency taken into account), for the beat lights. */
  current(): ScheduledClick | null {
    if (!this.playing || !this.ctx) return null;
    const heard = this.ctx.currentTime - this.latency();
    let cur: Booked | null = null;
    for (const c of this.queue) {
      if (c.time > heard) break;
      cur = c;
    }
    if (!cur) return null;
    const { osc: _o, gain: _g, ...click } = cur;
    return click;
  }

  destroy(): void {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) ctx.close().catch(() => undefined);
  }

  // ── internals ──

  private readonly tick = (): void => {
    this.timer = null;
    if (!this.playing) return;
    this.fill();
    this.timer = this.deps.setTimeout(this.tick, TICK_MS);
  };

  private fill(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const now = ctx.currentTime;
    if (this.nextTime < now - LATE_TOLERANCE_S) this.realign(now);
    const horizon = now + (this.deps.isHidden() ? HIDDEN_AHEAD_S : AHEAD_S);
    while (this.nextTime < horizon) this.book();
    this.prune(now);
  }

  /** Skips clicks we can no longer play on time (frozen tab) while keeping the bar grid. */
  private realign(now: number): void {
    let guard = 0;
    while (this.nextTime < now && guard++ < 1_000_000) this.advance();
  }

  private book(): void {
    const meter = meterById(this.s.meter);
    const sub = this.s.subdivision;
    const level = levelForStep(meter, sub, this.step, this.s.accent);
    const time = this.nextTime;
    const { osc, gain } = this.voice(level, time);
    this.queue.push({
      time, step: this.step, pulse: pulseForStep(meter, sub, this.step), level,
      stepDur: secondsPerStep(this.s.bpm, meter, sub), subs: effectiveSubdivision(meter, sub), osc, gain,
    });
    this.advance();
  }

  private advance(): void {
    const meter = meterById(this.s.meter);
    this.nextTime += secondsPerStep(this.s.bpm, meter, this.s.subdivision);
    this.step = (this.step + 1) % stepsPerBar(meter, this.s.subdivision);
  }

  /** Cancels booked clicks that have not started and books them again with the new settings. */
  private rebook(structural: boolean, prev: MetronomeSettings): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const cutoff = ctx.currentTime + CANCEL_MARGIN_S;
    const idx = this.queue.findIndex(c => c.time > cutoff);
    const prevMeter = meterById(prev.meter);
    let prevDur = secondsPerStep(prev.bpm, prevMeter, prev.subdivision);
    let prevSubs: number = effectiveSubdivision(prevMeter, prev.subdivision);
    if (idx >= 0) {
      const first = this.queue[idx];
      this.queue.slice(idx).forEach(c => this.silence(c));
      this.queue = this.queue.slice(0, idx);
      this.nextTime = first.time;
      this.step = first.step;
      prevDur = first.stepDur;
      prevSubs = first.subs;
    }
    if (structural) {
      // New compás/subdivision: start a fresh bar on the next beat of the old grid.
      const inBeat = this.step % prevSubs;
      if (inBeat) this.nextTime += (prevSubs - inBeat) * prevDur;
      this.step = 0;
    }
    this.fill();
  }

  private voice(level: ClickLevel, t: number): { osc: OscillatorLike | null; gain: GainLike | null } {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return { osc: null, gain: null };
    const v = VOICES[this.s.sound][level];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = v.type;
    osc.frequency.setValueAtTime(v.freq, t);
    if (v.endFreq) osc.frequency.exponentialRampToValueAtTime(v.endFreq, t + v.decay);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v.gain, t + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SILENT, t + v.decay);
    osc.connect(gain);
    gain.connect(master);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(t);
    osc.stop(t + v.decay + 0.01);
    return { osc, gain };
  }

  private silence(c: Booked): void {
    try {
      if (c.osc) { c.osc.onended = null; c.osc.disconnect(); }
      c.gain?.disconnect();
    } catch { /* already gone */ }
  }

  /** Drops clicks long past, always keeping the latest one that has played (the lit beat). */
  private prune(now: number): void {
    let drop = 0;
    while (drop + 1 < this.queue.length && this.queue[drop + 1].time <= now - 1) drop++;
    if (drop) this.queue = this.queue.slice(drop);
  }

  private latency(): number {
    const ctx = this.ctx;
    const l = (ctx?.baseLatency ?? 0) + (ctx?.outputLatency ?? 0);
    return Number.isFinite(l) ? Math.min(0.5, Math.max(0, l)) : 0;
  }

  private ensureContext(): AudioContextLike | null {
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;
    const ctx = this.deps.createContext();
    if (!ctx) return null;
    const master = ctx.createGain();
    master.gain.value = volumeToGain(this.s.volume);
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.primed = false;
    return ctx;
  }

  private resumeContext(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => undefined);
  }

  /** iOS unlock: a one-sample silent buffer played inside the first gesture. */
  private prime(ctx: AudioContextLike): void {
    if (this.primed || !ctx.createBuffer || !ctx.createBufferSource) return;
    this.primed = true;
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* harmless */ }
  }
}
