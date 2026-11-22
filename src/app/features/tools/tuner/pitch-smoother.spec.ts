import { InTuneTracker, PitchSmoother } from './pitch-smoother';

describe('PitchSmoother', () => {
  it('returns the median of recent readings, ignoring a single outlier', () => {
    const s = new PitchSmoother();
    [110, 110.2, 109.8, 110.1].forEach((f, i) => s.push(f, i * 25));
    expect(s.push(220, 100)!.frequency).toBeCloseTo(110.05, 1); // octave glitch dropped
    expect(s.push(110, 125)!.frequency).toBeCloseTo(110, 2);
  });

  it('smooths jitter around a note', () => {
    const s = new PitchSmoother();
    let out = 0;
    [82.4, 82.5, 83.5, 82.3, 82.45].forEach((f, i) => { out = s.push(f, i * 25)!.frequency; });
    expect(out).toBeCloseTo(82.45, 1);
  });

  it('switches at once after a confirmed jump to another note', () => {
    const s = new PitchSmoother();
    [82.4, 82.4, 82.4, 82.4, 82.4].forEach((f, i) => s.push(f, i * 25));
    expect(s.push(110, 200)!.frequency).toBeCloseTo(82.4, 1);
    expect(s.push(110.2, 225)!.frequency).toBeCloseTo(110.1, 1);
  });

  it('holds the last pitch after the signal drops, then clears', () => {
    const s = new PitchSmoother({ holdMs: 800 });
    s.push(196, 0);
    expect(s.push(null, 500)).toEqual({ frequency: 196, live: false });
    expect(s.push(null, 800)).toEqual({ frequency: 196, live: false });
    expect(s.push(null, 801)).toBeNull();
    expect(s.push(null, 900)).toBeNull();
    expect(s.push(330, 1000)).toEqual({ frequency: 330, live: true });
  });

  it('ignores invalid readings', () => {
    const s = new PitchSmoother();
    expect(s.push(NaN, 0)).toBeNull();
    expect(s.push(-1, 10)).toBeNull();
  });
});

describe('InTuneTracker', () => {
  it('requires |cents| ≤ 5 for 300 ms', () => {
    const t = new InTuneTracker();
    expect(t.update(2, 0)).toBeFalse();
    expect(t.update(-3, 200)).toBeFalse();
    expect(t.update(1, 300)).toBeTrue();
  });

  it('restarts the timer when the pitch leaves the zone', () => {
    const t = new InTuneTracker();
    t.update(2, 0);
    t.update(12, 150);
    expect(t.update(2, 300)).toBeFalse();
    expect(t.update(2, 600)).toBeTrue();
  });

  it('stays in tune within the hysteresis band and leaves beyond it', () => {
    const t = new InTuneTracker();
    t.update(0, 0);
    t.update(0, 300);
    expect(t.update(7, 350)).toBeTrue();
    expect(t.update(9, 400)).toBeFalse();
    expect(t.update(null, 500)).toBeFalse();
  });
});
