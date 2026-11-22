import { AHEAD_S, HIDDEN_AHEAD_S, MetronomeEngine, START_DELAY_S, VOICES, volumeToGain } from './metronome-engine';
import { MetronomeSettings } from './metronome-model';
import { FakeClock } from './testing/fake-audio';

describe('MetronomeEngine', () => {
  let clock: FakeClock;

  function engine(settings: Partial<MetronomeSettings> = {}) {
    clock = new FakeClock();
    return new MetronomeEngine({ bpm: 120, meter: '4/4', subdivision: 1, accent: true, ...settings }, clock.deps());
  }
  const diffs = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

  it('books 120 bpm 4/4 corcheas exactly 0.25 s apart, starting just after Start', () => {
    const e = engine({ subdivision: 2 });
    expect(e.start()).toBeTrue();
    clock.advance(3);
    const times = clock.ctx.audible;
    expect(times[0]).toBeCloseTo(START_DELAY_S, 12);
    diffs(times).forEach(d => expect(d).toBeCloseTo(0.25, 12));
  });

  for (const [bpm, sub, step] of [[60, 1, 1], [90, 3, 60 / 90 / 3], [200, 4, 0.075], [300, 4, 0.05], [30, 1, 2]] as const) {
    it(`spaces ${bpm} bpm with subdivision ${sub} at ${step.toFixed(4)} s`, () => {
      const e = engine({ bpm, subdivision: sub });
      e.start();
      clock.advance(8);
      const d = diffs(clock.ctx.audible);
      expect(d.length).toBeGreaterThan(1);
      d.forEach(x => expect(Math.abs(x - step)).toBeLessThan(1e-9));
    });
  }

  it('does not drift: click n is exactly start + n·step after 1000+ beats', () => {
    const e = engine({ bpm: 137, subdivision: 1 });
    e.start();
    clock.advance(460, 0.1);
    const times = clock.ctx.audible;
    expect(times.length).toBeGreaterThan(1000);
    const step = 60 / 137;
    const n = times.length - 1;
    expect(Math.abs(times[n] - (times[0] + n * step))).toBeLessThan(1e-9);
  });

  it('only books inside the lookahead window, and a wider one while hidden', () => {
    const e = engine({ bpm: 300, subdivision: 4 });
    e.start();
    clock.advance(1);
    expect(Math.max(...clock.ctx.audible)).toBeLessThan(1 + AHEAD_S);
    clock.hidden = true;
    e.wake();
    expect(Math.max(...clock.ctx.audible)).toBeGreaterThan(1 + AHEAD_S);
    expect(Math.max(...clock.ctx.audible)).toBeLessThan(1 + HIDDEN_AHEAD_S);
  });

  it('applies a tempo change from the next beat, without a gap or double click', () => {
    const e = engine({ bpm: 120 });
    e.start();
    clock.advance(1.2); // clicks at .06 .56 1.06; 1.56 already booked
    e.update({ bpm: 60 });
    clock.advance(3);
    const t = clock.ctx.audible;
    expect(t.slice(0, 6).map(x => +x.toFixed(9))).toEqual([0.06, 0.56, 1.06, 1.56, 2.56, 3.56]);
    expect(new Set(t).size).toBe(t.length);
  });

  it('starts a fresh bar on the next beat when compás or subdivision changes', () => {
    const e = engine({ bpm: 120, subdivision: 2, meter: '4/4' });
    e.start();
    clock.advance(0.4); // .06 .31 played, .56 booked
    e.update({ subdivision: 1, meter: '3/4' });
    clock.advance(2);
    const t = clock.ctx.audible.map(x => +x.toFixed(9));
    expect(t.slice(0, 5)).toEqual([0.06, 0.31, 0.56, 1.06, 1.56]);
    const freqs = clock.ctx.oscillators.filter(o => !o.disconnected && o.startAt! > 0.5).map(o => o.frequency.events[0][1]);
    const { accent, beat } = VOICES.click;
    expect(freqs.slice(0, 4)).toEqual([accent.freq, beat.freq, beat.freq, accent.freq]);
    expect(e.settings.meter).toBe('3/4');
  });

  it('re-aligns mid-beat structural changes to the old beat grid', () => {
    const e = engine({ bpm: 120, subdivision: 4 });
    e.start();
    clock.advance(0.2); // 16ths every .125: .06 .185 booked .31 .435 .56
    e.update({ subdivision: 1 });
    clock.advance(1.5);
    const later = clock.ctx.audible.filter(x => x > 0.2).map(x => +x.toFixed(9));
    expect(later.slice(0, 3)).toEqual([0.56, 1.06, 1.56]);
  });

  it('marks accents per compás, incl. 6/8 (3+3), 7/8 (2+2+3) and 12/8', () => {
    const levelsFor = (meter: MetronomeSettings['meter'], accent = true, subdivision: MetronomeSettings['subdivision'] = 1) => {
      const e = engine({ meter, accent, subdivision, bpm: 300 });
      clock.hidden = true; // 2 s window: more than a whole bar gets booked
      e.start();
      clock.advance(1);
      const s = e.scheduled;
      const bar = s.findIndex((c, i) => i > 0 && c.step === 0);
      return s.slice(0, bar).map(c => c.level[0]).join('');
    };
    expect(levelsFor('4/4')).toBe('abbb');
    expect(levelsFor('4/4', false)).toBe('bbbb');
    expect(levelsFor('4/4', true, 2)).toBe('asbsbsbs');
    expect(levelsFor('6/8')).toBe('assbss');
    expect(levelsFor('7/8')).toBe('asbsbss');
    expect(levelsFor('12/8')).toBe('assbssbssbss');
    expect(levelsFor('6/8', true, 4)).toBe('assbss'); // subdivisions ignored in x/8
  });

  it('uses distinct voices: higher accent, softer subdivision, Madera with a pitch drop', () => {
    const e = engine({ subdivision: 2, sound: 'click' });
    e.start();
    clock.advance(0.5);
    const [accent, sub, beat] = clock.ctx.oscillators;
    expect(accent.frequency.events[0][1]).toBe(VOICES.click.accent.freq);
    expect(accent.frequency.events[0][1]).toBeGreaterThan(beat.frequency.events[0][1]);
    expect(VOICES.click.sub.gain).toBeLessThan(VOICES.click.beat.gain);
    expect(sub.frequency.events[0][1]).toBe(VOICES.click.sub.freq);
    e.update({ sound: 'wood' });
    clock.advance(0.5);
    const wood = clock.ctx.oscillators.filter(o => !o.disconnected).pop()!;
    expect(wood.frequency.events.some(ev => ev[0] === 'exp')).toBeTrue();
  });

  it('ramps each click envelope from silence at its exact start time', () => {
    const e = engine();
    e.start();
    clock.advance(0.1);
    const g = clock.ctx.gains[1].gain.events; // [0] is the master gain
    expect(g[0]).toEqual(['set', 0, START_DELAY_S]);
    expect(g[1][0]).toBe('lin');
    expect(g[2][0]).toBe('exp');
  });

  it('sets master volume on a squared curve', () => {
    const e = engine({ volume: 0.5 });
    e.start();
    expect(clock.ctx.gains[0].gain.value).toBeCloseTo(0.25, 9);
    e.update({ volume: 1 });
    expect(clock.ctx.gains[0].gain.value).toBe(volumeToGain(1));
  });

  it('stop cancels booked clicks and the timer; start again begins a new bar', () => {
    const e = engine({ bpm: 300, subdivision: 4 });
    e.start();
    clock.advance(0.5);
    e.stop();
    expect(e.isPlaying).toBeFalse();
    expect(clock.timers).toBe(0);
    expect(clock.ctx.audible.every(t => t <= 0.5)).toBeTrue();
    clock.advance(1);
    e.start();
    clock.advance(0.2);
    const restart = e.scheduled[0];
    expect(restart.time).toBeCloseTo(1.5 + START_DELAY_S, 9);
    expect(restart.level).toBe('accent');
  });

  it('skips missed clicks after a frozen tab instead of bursting, keeping the grid', () => {
    const e = engine({ bpm: 120 });
    e.start();
    clock.advance(1);
    clock.ctx.currentTime = 10.3; // timers never ran for 9 s
    clock.flush();
    const late = clock.ctx.audible.filter(t => t > 1.5);
    expect(late.every(t => t >= 10.3)).toBeTrue();
    late.forEach(t => expect(Math.abs(((t - START_DELAY_S) / 0.5) % 1)).toBeLessThan(1e-9));
  });

  it('reports the click being heard, compensating output latency', () => {
    const e = engine({ bpm: 120 });
    e.start();
    clock.ctx.outputLatency = 0.05;
    clock.advance(0.1);
    expect(e.current()).toBeNull(); // .06 + .05 latency not reached
    clock.advance(0.025);
    expect(e.current()?.pulse).toBe(0);
    clock.advance(0.5);
    expect(e.current()?.pulse).toBe(1);
  });

  it('unlocks audio inside the gesture (primes once), suspends on stop and resumes on start', () => {
    const e = engine();
    e.start();
    expect(clock.ctx.resumed).toBe(1);
    e.stop();
    expect(clock.ctx.suspended).toBe(1);
    expect(clock.ctx.closed).toBeFalse();
    clock.ctx.state = 'running'; // a suspend still pending reports 'running'
    e.start();
    expect(clock.ctx.resumed).toBe(2);
    expect(clock.ctx.primed).toBe(1);
  });

  it('returns false without Web Audio', () => {
    const e = new MetronomeEngine({}, { createContext: () => null });
    expect(e.start()).toBeFalse();
    expect(e.isPlaying).toBeFalse();
  });

  it('destroy stops and closes the AudioContext', () => {
    const e = engine();
    e.start();
    clock.advance(0.3);
    e.destroy();
    expect(clock.ctx.closed).toBeTrue();
    expect(clock.timers).toBe(0);
    expect(e.isPlaying).toBeFalse();
  });
});
