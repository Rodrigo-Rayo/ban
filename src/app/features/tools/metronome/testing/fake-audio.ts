import { AudioContextLike, EngineDeps, GainLike, OscillatorLike, ParamLike } from '../metronome-engine';

/** Test doubles for the metronome engine: a hand-cranked AudioContext and timer. */
export class FakeParam implements ParamLike {
  value = 1;
  readonly events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['lin', v, t]); }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push(['exp', v, t]); }
  setTargetAtTime(v: number, t: number) { this.events.push(['target', v, t]); this.value = v; }
}

export class FakeGain implements GainLike {
  readonly gain = new FakeParam();
  disconnected = false;
  connect() { return undefined; }
  disconnect() { this.disconnected = true; }
}

export class FakeOsc implements OscillatorLike {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  startAt: number | null = null;
  stopAt: number | null = null;
  disconnected = false;
  connect() { return undefined; }
  disconnect() { this.disconnected = true; }
  start(when: number) { this.startAt = when; }
  stop(when: number) { this.stopAt = when; }
}

export class FakeContext implements AudioContextLike {
  currentTime = 0;
  state = 'suspended';
  readonly destination = {};
  outputLatency = 0;
  baseLatency = 0;
  readonly oscillators: FakeOsc[] = [];
  readonly gains: FakeGain[] = [];
  resumed = 0;
  closed = false;
  primed = 0;
  createOscillator() { const o = new FakeOsc(); this.oscillators.push(o); return o; }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBuffer() { return {}; }
  createBufferSource() { return { buffer: null as unknown, connect: () => undefined, start: () => { this.primed++; } }; }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }

  /** Start times of clicks that will actually sound (not cancelled). */
  get audible(): number[] {
    return this.oscillators.filter(o => !o.disconnected).map(o => o.startAt as number);
  }
}

/** Manual timer: `advance(seconds)` moves the audio clock and fires due timers. */
export class FakeClock {
  readonly ctx = new FakeContext();
  hidden = false;
  private pending: { id: number; fn: () => void }[] = [];
  private seq = 0;

  deps(): EngineDeps {
    return {
      createContext: () => this.ctx,
      setTimeout: fn => { const id = ++this.seq; this.pending.push({ id, fn }); return id; },
      clearTimeout: id => { this.pending = this.pending.filter(p => p.id !== id); },
      isHidden: () => this.hidden,
    };
  }

  get timers(): number { return this.pending.length; }

  /** Advances the clock in `stepS` slices (default 25 ms, like the real ticker). */
  advance(seconds: number, stepS = 0.025): void {
    const end = this.ctx.currentTime + seconds;
    while (this.ctx.currentTime < end - 1e-12) {
      this.ctx.currentTime = Math.min(end, this.ctx.currentTime + stepS);
      this.flush();
    }
  }

  /** Fires timers that are due now. */
  flush(): void {
    const due = this.pending;
    this.pending = [];
    due.forEach(p => p.fn());
  }
}
