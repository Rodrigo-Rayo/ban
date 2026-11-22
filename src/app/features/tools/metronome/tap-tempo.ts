import { clampBpm } from './metronome-model';

/** A pause longer than this starts a new tap sequence (a bit over 2 s so 30 bpm still taps). */
export const TAP_RESET_MS = 2200;
/** How many recent intervals are averaged. */
export const TAP_WINDOW = 6;
/** Intervals further than this fraction from the median are treated as mis-taps. */
export const TAP_OUTLIER = 0.25;

/**
 * Tap tempo: averages the last few intervals around their median, so one
 * double or missed tap does not throw the result off.
 */
export class TapTempo {
  private last: number | null = null;
  private intervals: number[] = [];

  /** Registers a tap at `now` (ms) and returns the BPM once there are two taps. */
  tap(now: number): number | null {
    const gap = this.last === null ? null : now - this.last;
    this.last = now;
    if (gap === null || gap > TAP_RESET_MS || gap <= 0) {
      this.intervals = [];
      return null;
    }
    this.intervals = [...this.intervals, gap].slice(-TAP_WINDOW);
    return this.bpm();
  }

  reset(): void {
    this.last = null;
    this.intervals = [];
  }

  get count(): number {
    return this.intervals.length;
  }

  private bpm(): number | null {
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const kept = this.intervals.filter(i => Math.abs(i - median) <= median * TAP_OUTLIER);
    const use = kept.length ? kept : [median];
    const avg = use.reduce((s, i) => s + i, 0) / use.length;
    return clampBpm(60000 / avg);
  }
}
