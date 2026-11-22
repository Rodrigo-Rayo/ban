import { PitchDetector } from 'pitchy';
import { centsBetween } from './note-math';
import { EngineDeps, PitchEngine, TunerError, browserDeps, detect, mapMediaError, windowSizes } from './pitch-engine';

const RATE = 48000;

/** String-like tone: fundamental plus decaying harmonics, random phases. */
function tone(freq: number, length: number, amp = 0.3, harmonics = 8, offset = 0): Float32Array {
  const buf = new Float32Array(length);
  const phases = Array.from({ length: harmonics }, (_, h) => (h * 1.7) % (2 * Math.PI));
  for (let i = 0; i < length; i++) {
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += Math.sin(2 * Math.PI * freq * h * (i + offset) / RATE + phases[h - 1]) / h;
    buf[i] = v * amp * 0.6;
  }
  return buf;
}

describe('pitch detection accuracy (real pitchy)', () => {
  const { short, long } = windowSizes(RATE);
  const shortDet = PitchDetector.forFloat32Array(short);
  const longDet = PitchDetector.forFloat32Array(long);

  it('uses 4096/8192 windows at 44.1 and 48 kHz', () => {
    expect(windowSizes(48000)).toEqual({ short: 4096, long: 8192 });
    expect(windowSizes(44100)).toEqual({ short: 4096, long: 8192 });
    expect(windowSizes(96000)).toEqual({ short: 8192, long: 16384 });
  });

  const cases: [string, number, 'short' | 'long'][] = [
    ['guitar E2', 82.41, 'short'],
    ['A2 +20 cents', 110 * Math.pow(2, 20 / 1200), 'short'],
    ['E4', 329.63, 'short'],
    ['ukulele A4', 440, 'short'],
    ['bass E1', 41.2, 'long'],
    ['bass B0', 30.87, 'long'],
  ];
  cases.forEach(([label, freq, win]) => {
    it(`detects ${label} within 1 cent`, () => {
      const n = win === 'short' ? short : long;
      const pitch = detect(win === 'short' ? shortDet : longDet, tone(freq, n), RATE);
      expect(pitch).not.toBeNull();
      expect(Math.abs(centsBetween(pitch!, freq))).toBeLessThan(1);
    });
  });

  it('rejects silence, very quiet input and white noise', () => {
    expect(detect(shortDet, new Float32Array(short), RATE)).toBeNull();
    expect(detect(shortDet, tone(110, short, 0.002), RATE)).toBeNull();
    let seed = 7;
    const noise = new Float32Array(short).map(() => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.4;
    });
    expect(detect(shortDet, noise, RATE)).toBeNull();
  });
});

describe('mapMediaError', () => {
  const err = (name: string) => Object.assign(new Error(name), { name });
  it('maps browser errors to codes', () => {
    expect(mapMediaError(err('NotAllowedError'))).toBe('denied');
    expect(mapMediaError(err('SecurityError'))).toBe('denied');
    expect(mapMediaError(err('NotFoundError'))).toBe('no-mic');
    expect(mapMediaError(err('OverconstrainedError'))).toBe('no-mic');
    expect(mapMediaError(err('NotReadableError'))).toBe('busy');
    expect(mapMediaError(err('TypeError'))).toBe('unknown');
    expect(mapMediaError(null)).toBe('unknown');
    expect(mapMediaError(new TunerError('insecure'))).toBe('insecure');
  });

  it('reports missing mediaDevices as unsupported', () => {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => undefined });
    try {
      expect(() => browserDeps()).toThrowMatching(e => e instanceof TunerError && e.code === 'unsupported');
    } finally {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
      if (desc && !Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaDevices')) {
        Object.defineProperty(Navigator.prototype, 'mediaDevices', desc);
      }
    }
  });
});

/** Minimal fakes for the Web Audio graph. */
function setup(signal: (n: number, call: number) => Float32Array) {
  const track = jasmine.createSpyObj<MediaStreamTrack>('track', ['stop', 'addEventListener', 'removeEventListener']);
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  let calls = 0;
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 1,
    connect: jasmine.createSpy('connect'),
    getFloatTimeDomainData: (buf: Float32Array) => buf.set(signal(buf.length, calls++)),
  };
  const ctx = {
    sampleRate: RATE,
    state: 'running',
    destination: {},
    resume: jasmine.createSpy('resume').and.resolveTo(),
    close: jasmine.createSpy('close').and.callFake(() => { ctx.state = 'closed'; return Promise.resolve(); }),
    createAnalyser: () => analyser,
    createMediaStreamSource: jasmine.createSpy('source').and.returnValue({ connect: jasmine.createSpy() }),
    createGain: () => ({ gain: { value: 1 }, connect: jasmine.createSpy() }),
    addEventListener: jasmine.createSpy(),
    removeEventListener: jasmine.createSpy(),
  };
  const frames: ((t: number) => void)[] = [];
  let clock = 0;
  let gumResult: Promise<MediaStream> = Promise.resolve(stream);
  const deps: EngineDeps = {
    getUserMedia: jasmine.createSpy('gum').and.callFake(() => gumResult),
    createContext: jasmine.createSpy('ctx').and.returnValue(ctx as unknown as AudioContext),
    createDetector: size => PitchDetector.forFloat32Array(size),
    requestFrame: cb => frames.push(cb),
    cancelFrame: jasmine.createSpy('cancel'),
    now: () => clock,
  };
  const readings: (number | null)[] = [];
  const errors: string[] = [];
  const engine = new PitchEngine(f => readings.push(f), c => errors.push(c), () => deps);
  const runFrames = (n: number) => {
    for (let i = 0; i < n; i++) {
      clock += 30;
      const cb = frames.shift();
      cb?.(clock);
    }
  };
  return {
    engine, deps, ctx, track, analyser, readings, errors, runFrames, frames,
    rejectWith: (e: unknown) => { gumResult = Promise.reject(e); },
    deferGum: () => {
      let resolve!: (s: MediaStream) => void;
      gumResult = new Promise(r => { resolve = r; });
      return () => resolve(stream);
    },
  };
}

describe('PitchEngine lifecycle', () => {
  it('requests the mic with voice processing disabled and detects pitch', async () => {
    const t = setup(n => tone(82.41, n));
    await t.engine.start();
    expect(t.deps.getUserMedia).toHaveBeenCalledWith(jasmine.objectContaining({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }));
    expect(t.engine.running).toBeTrue();
    expect(t.analyser.fftSize).toBe(8192);
    t.runFrames(3);
    expect(t.readings.length).toBe(3);
    expect(Math.abs(centsBetween(t.readings[0]!, 82.41))).toBeLessThan(1);
  });

  it('creates and resumes the AudioContext synchronously, before the permission prompt resolves', () => {
    const t = setup(n => tone(110, n));
    void t.engine.start();
    expect(t.deps.createContext).toHaveBeenCalled();
    expect(t.ctx.resume).toHaveBeenCalled();
  });

  it('uses the long window in bass mode for a 30.87 Hz low B', async () => {
    const t = setup(n => tone(30.87, n));
    t.engine.setWindowMode('long');
    await t.engine.start();
    t.runFrames(1);
    expect(Math.abs(centsBetween(t.readings[0]!, 30.87))).toBeLessThan(1);
  });

  it('auto mode re-checks low notes with the long window', async () => {
    const t = setup(n => tone(41.2, n));
    await t.engine.start();
    t.runFrames(1);
    expect(Math.abs(centsBetween(t.readings[0]!, 41.2))).toBeLessThan(2);
  });

  it('stop() releases the mic, closes the context and halts the loop', async () => {
    const t = setup(n => tone(110, n));
    await t.engine.start();
    t.engine.stop();
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.ctx.close).toHaveBeenCalled();
    expect(t.engine.running).toBeFalse();
    t.runFrames(3);
    expect(t.readings.length).toBe(0);
  });

  it('can restart cleanly after stopping', async () => {
    const t = setup(n => tone(110, n));
    await t.engine.start();
    t.engine.stop();
    await t.engine.start();
    expect(t.deps.createContext).toHaveBeenCalledTimes(2);
    expect(t.engine.running).toBeTrue();
  });

  it('stop() while the permission prompt is open releases the stream when it arrives', async () => {
    const t = setup(n => tone(110, n));
    const grant = t.deferGum();
    const started = t.engine.start();
    t.engine.stop();
    grant();
    await started;
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.engine.running).toBeFalse();
  });

  it('rejects with a mapped TunerError and cleans up when permission is denied', async () => {
    const t = setup(n => tone(110, n));
    t.rejectWith(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await expectAsync(t.engine.start()).toBeRejectedWith(jasmine.objectContaining({ code: 'denied' }));
    expect(t.ctx.close).toHaveBeenCalled();
    expect(t.engine.running).toBeFalse();
  });

  it('reports "lost" when the track ends (mic unplugged / revoked)', async () => {
    const t = setup(n => tone(110, n));
    await t.engine.start();
    const ended = t.track.addEventListener.calls.mostRecent().args[1] as () => void;
    ended();
    expect(t.errors).toEqual(['lost']);
    expect(t.engine.running).toBeFalse();
  });

  it('wraps environment failures (no mediaDevices) as TunerError', async () => {
    const engine = new PitchEngine(() => undefined, () => undefined, () => { throw new TunerError('unsupported'); });
    await expectAsync(engine.start()).toBeRejectedWith(jasmine.objectContaining({ code: 'unsupported' }));
  });
});
