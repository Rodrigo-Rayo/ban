import { centsBetween } from './note-math';

/** One detection frame: a clear pitch, or null when there is silence/noise. */
export type RawReading = number | null;

export interface SmoothedPitch {
  /** Smoothed frequency in Hz. */
  frequency: number;
  /** False while the last value is only being held after the signal dropped. */
  live: boolean;
}

export interface SmootherOptions {
  /** Readings in the median window. */
  window: number;
  /** How long the last pitch stays on screen after the signal drops, in ms. */
  holdMs: number;
  /** A reading this far (in cents) from the current pitch counts as a jump to another note. */
  jumpCents: number;
  /** Consecutive agreeing readings needed to accept a jump (single outliers are dropped). */
  jumpConfirm: number;
}

const DEFAULTS: SmootherOptions = { window: 5, holdMs: 800, jumpCents: 60, jumpConfirm: 2 };

/**
 * Median smoothing with a short hold. A sudden jump to a different pitch must be confirmed by
 * consecutive readings and then replaces the history at once, so changing strings is instant but a
 * single octave glitch never reaches the needle.
 */
export class PitchSmoother {
  private readonly opts: SmootherOptions;
  private readonly history: number[] = [];
  private readonly scratch: number[] = [];
  private candidates: number[] = [];
  private current: number | null = null;
  private lastLiveAt = 0;

  constructor(options: Partial<SmootherOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  reset(): void {
    this.history.length = 0;
    this.candidates = [];
    this.current = null;
    this.lastLiveAt = 0;
  }

  push(reading: RawReading, now: number): SmoothedPitch | null {
    if (reading !== null && Number.isFinite(reading) && reading > 0) {
      this.accept(reading);
      if (this.current !== null) {
        this.lastLiveAt = now;
        return { frequency: this.current, live: true };
      }
    }
    if (this.current !== null && now - this.lastLiveAt <= this.opts.holdMs) {
      return { frequency: this.current, live: false };
    }
    if (this.current !== null) this.reset();
    return null;
  }

  private accept(reading: number): void {
    if (this.current === null || Math.abs(centsBetween(reading, this.current)) <= this.opts.jumpCents) {
      this.candidates = [];
      this.add(reading);
      return;
    }
    // Possible jump: keep it aside until enough consecutive readings agree with each other.
    const last = this.candidates[this.candidates.length - 1];
    if (last !== undefined && Math.abs(centsBetween(reading, last)) > this.opts.jumpCents) this.candidates = [];
    this.candidates.push(reading);
    if (this.candidates.length >= this.opts.jumpConfirm) {
      this.history.length = 0;
      const seeds = this.candidates;
      this.candidates = [];
      seeds.forEach(r => this.add(r));
    }
  }

  private add(reading: number): void {
    this.history.push(reading);
    if (this.history.length > this.opts.window) this.history.shift();
    this.current = median(this.history, this.scratch);
  }
}

function median(values: readonly number[], scratch: number[]): number {
  scratch.length = 0;
  for (const v of values) scratch.push(v);
  scratch.sort((a, b) => a - b);
  const mid = scratch.length >> 1;
  return scratch.length % 2 ? scratch[mid] : (scratch[mid - 1] + scratch[mid]) / 2;
}

/** "In tune" only after |cents| ≤ threshold holds for `sustainMs`; leaves with a little hysteresis. */
export class InTuneTracker {
  private since: number | null = null;
  private inTune = false;

  constructor(private readonly threshold = 5, private readonly sustainMs = 300, private readonly release = 8) {}

  reset(): void {
    this.since = null;
    this.inTune = false;
  }

  update(cents: number | null, now: number): boolean {
    if (cents === null) {
      this.reset();
      return false;
    }
    const abs = Math.abs(cents);
    if (this.inTune) {
      if (abs > this.release) this.reset();
      return this.inTune;
    }
    if (abs > this.threshold) {
      this.since = null;
      return false;
    }
    if (this.since === null) this.since = now;
    this.inTune = now - this.since >= this.sustainMs;
    return this.inTune;
  }
}
