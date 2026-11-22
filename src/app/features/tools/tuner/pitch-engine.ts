import { PitchDetector } from 'pitchy';

/** Why the microphone could not be used. */
export type TunerErrorCode = 'insecure' | 'unsupported' | 'denied' | 'no-mic' | 'busy' | 'lost' | 'audio' | 'unknown';

export class TunerError extends Error {
  constructor(readonly code: TunerErrorCode, cause?: unknown) {
    super(code);
    this.name = 'TunerError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export const TUNER_ERROR_MESSAGES: Record<TunerErrorCode, string> = {
  insecure: 'El micrófono solo funciona en una conexión segura (https). Abre www.bandyou.es/afinador.',
  unsupported: 'Tu navegador no permite usar el micrófono. Prueba con una versión reciente de Chrome, Safari, Firefox o Edge.',
  denied: 'No tenemos permiso para usar el micrófono. Toca el candado o el icono junto a la dirección web, permite el micrófono para bandyou.es y vuelve a intentarlo. En iPhone: Ajustes › Safari › Micrófono.',
  'no-mic': 'No encontramos ningún micrófono. Conecta uno o revisa que esté activado en tu dispositivo.',
  busy: 'El micrófono está ocupado por otra app (una llamada, otra pestaña, una app de grabación…). Ciérrala y vuelve a intentarlo.',
  lost: 'Se ha perdido la conexión con el micrófono. Vuelve a activarlo.',
  audio: 'No se pudo activar el audio. Toca de nuevo Activar micrófono.',
  unknown: 'No hemos podido activar el micrófono. Recarga la página y vuelve a intentarlo.',
};

/** Maps a getUserMedia / AudioContext failure to a code the UI can explain. */
export function mapMediaError(err: unknown): TunerErrorCode {
  if (err instanceof TunerError) return err.code;
  const name = (err as { name?: unknown } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-mic';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

/** Detection thresholds. */
export const MIN_CLARITY = 0.9;
export const MIN_RMS = 0.004;
export const MIN_FREQ = 25;
export const MAX_FREQ = 1500;
/** Detection interval; the analyser window overlaps between runs. */
const FRAME_MS = 25;
/** Below this the short window is re-checked with the long one (chromatic mode). */
const LOW_FREQ_RECHECK = 100;

/**
 * Window sizes: "short" ≈ 85 ms (4096 samples at 44.1/48 kHz, ≥7 periods of a guitar's low E),
 * "long" ≈ 170 ms (8192, ≥5 periods of a bass's low B at 30.9 Hz).
 */
export function windowSizes(sampleRate: number): { short: number; long: number } {
  let short = 2048;
  while (short < sampleRate * 0.085) short *= 2;
  return { short, long: short * 2 };
}

export type WindowMode = 'short' | 'long' | 'auto';

export interface PitchDetectorLike {
  findPitch(input: Float32Array, sampleRate: number): [number, number];
}

export interface EngineDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createContext: () => AudioContext;
  createDetector: (size: number) => PitchDetectorLike;
  requestFrame: (cb: (t: number) => void) => number;
  cancelFrame: (id: number) => void;
  now: () => number;
}

export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  // Browser voice processing (echo/noise suppression, auto gain) distorts pitch: turn it all off.
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  video: false,
};

/** Fills in the real browser APIs; throws TunerError when the environment can't run the tuner. */
export function browserDeps(): EngineDeps {
  if (typeof window === 'undefined') throw new TunerError('unsupported');
  if (window.isSecureContext === false) throw new TunerError('insecure');
  const media = navigator.mediaDevices;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!media || typeof media.getUserMedia !== 'function' || !Ctx) throw new TunerError('unsupported');
  return {
    getUserMedia: c => media.getUserMedia(c),
    createContext: () => new Ctx(),
    createDetector: size => PitchDetector.forFloat32Array(size),
    requestFrame: cb => requestAnimationFrame(cb),
    cancelFrame: id => cancelAnimationFrame(id),
    now: () => performance.now(),
  };
}

/** Root-mean-square level of a buffer. */
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** Pitch from one buffer, or null if it is too quiet, unclear or out of range. */
export function detect(detector: PitchDetectorLike, buf: Float32Array, sampleRate: number): number | null {
  if (rms(buf) < MIN_RMS) return null;
  const [pitch, clarity] = detector.findPitch(buf, sampleRate);
  if (clarity < MIN_CLARITY || !Number.isFinite(pitch) || pitch < MIN_FREQ || pitch > MAX_FREQ) return null;
  return pitch;
}

/** Resolves when `p` settles or after `ms`, whichever comes first (never rejects). */
function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    p.then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
  });
}

export type ReadingListener = (frequency: number | null, now: number) => void;
export type ErrorListener = (code: TunerErrorCode) => void;

/**
 * Microphone → AnalyserNode → McLeod pitch detection, on animation frames.
 * Framework-free; the caller decides which zone the callbacks run in.
 */
export class PitchEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private frameId: number | null = null;
  private lastRun = 0;
  private generation = 0;
  private buffers: { long: Float32Array<ArrayBuffer>; short: Float32Array<ArrayBuffer> } | null = null;
  private detectors: { long: PitchDetectorLike; short: PitchDetectorLike } | null = null;
  private windowMode: WindowMode = 'auto';
  private deps: EngineDeps | null = null;
  /** How long to wait for AudioContext.resume() before giving up. */
  resumeTimeoutMs = 3000;
  private readonly onTrackEnded = () => this.fail('lost');
  private readonly onStateChange = () => {
    const state = this.ctx?.state as string | undefined;
    // iOS suspends/interrupts the context on calls or Siri; try to pick up again.
    if (state === 'suspended' || state === 'interrupted') this.ctx?.resume().catch(() => undefined);
  };

  constructor(
    private readonly onReading: ReadingListener,
    private readonly onError: ErrorListener,
    private readonly depsFactory: () => EngineDeps = browserDeps,
  ) {}

  get running(): boolean {
    return this.stream !== null;
  }

  setWindowMode(mode: WindowMode): void {
    this.windowMode = mode;
  }

  /**
   * Must be called from a user gesture: the AudioContext is created and resumed synchronously,
   * before the permission prompt, which iOS Safari requires. Rejects with TunerError.
   */
  async start(): Promise<void> {
    this.stop();
    const gen = ++this.generation;
    let deps: EngineDeps;
    let ctx: AudioContext;
    try {
      deps = this.depsFactory();
      ctx = deps.createContext();
    } catch (err) {
      throw new TunerError(mapMediaError(err), err);
    }
    this.ctx = ctx;
    this.deps = deps;
    ctx.addEventListener('statechange', this.onStateChange);
    // Resume inside the gesture (iOS); the result is checked once the mic is granted.
    const resumed = ctx.resume().catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia(AUDIO_CONSTRAINTS);
    } catch (err) {
      if (gen === this.generation) this.teardown();
      throw new TunerError(mapMediaError(err), err);
    }
    if (gen !== this.generation) {
      // stop() or another start() happened while the prompt was open.
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    this.stream = stream;
    try {
      await withTimeout(resumed, this.resumeTimeoutMs);
      // Some browsers only let the context run once the mic is live: one more try.
      if (ctx.state !== 'running') await withTimeout(ctx.resume().catch(() => undefined), this.resumeTimeoutMs);
      if (gen !== this.generation) return;
      if (ctx.state !== 'running') throw new TunerError('audio');
      this.wire(ctx, stream, deps);
    } catch (err) {
      if (gen === this.generation) this.teardown();
      throw err instanceof TunerError ? err : new TunerError(mapMediaError(err), err);
    }
    this.loop(deps, gen);
  }

  stop(): void {
    this.generation++;
    this.teardown();
  }

  private wire(ctx: AudioContext, stream: MediaStream, deps: EngineDeps): void {
    const { short, long } = windowSizes(ctx.sampleRate);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = long;
    analyser.smoothingTimeConstant = 0;
    const source = ctx.createMediaStreamSource(stream);
    // A muted path to the destination keeps every browser pulling audio through the analyser.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(analyser);
    analyser.connect(mute);
    mute.connect(ctx.destination);

    const longBuf = new Float32Array(new ArrayBuffer(long * 4));
    this.buffers = { long: longBuf, short: longBuf.subarray(long - short) };
    this.detectors = { long: deps.createDetector(long), short: deps.createDetector(short) };
    this.analyser = analyser;
    stream.getTracks().forEach(t => t.addEventListener('ended', this.onTrackEnded));
  }

  private loop(deps: EngineDeps, gen: number): void {
    const tick = () => {
      if (gen !== this.generation || !this.analyser) return;
      this.frameId = deps.requestFrame(tick);
      const now = deps.now();
      if (now - this.lastRun < FRAME_MS) return;
      this.lastRun = now;
      this.onReading(this.measure(), now);
    };
    this.frameId = deps.requestFrame(tick);
  }

  /** One detection pass over the newest audio. */
  private measure(): number | null {
    const { analyser, buffers, detectors, ctx } = this;
    if (!analyser || !buffers || !detectors || !ctx) return null;
    analyser.getFloatTimeDomainData(buffers.long);
    const rate = ctx.sampleRate;
    if (this.windowMode === 'long') return detect(detectors.long, buffers.long, rate);
    const quick = detect(detectors.short, buffers.short, rate);
    if (this.windowMode === 'short') return quick;
    // Chromatic: the short window answers fast; low or unclear notes get a second look with the long one.
    if (quick !== null && quick >= LOW_FREQ_RECHECK) return quick;
    return detect(detectors.long, buffers.long, rate) ?? quick;
  }

  private fail(code: TunerErrorCode): void {
    if (!this.running) return;
    this.stop();
    this.onError(code);
  }

  private teardown(): void {
    if (this.frameId !== null) this.deps?.cancelFrame(this.frameId);
    this.frameId = null;
    this.stream?.getTracks().forEach(t => {
      t.removeEventListener('ended', this.onTrackEnded);
      t.stop();
    });
    this.stream = null;
    this.analyser = null;
    this.buffers = null;
    this.detectors = null;
    if (this.ctx) {
      this.ctx.removeEventListener('statechange', this.onStateChange);
      if (this.ctx.state !== 'closed') this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.deps = null;
  }
}
