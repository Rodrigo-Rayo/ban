import { midiToFrequency } from './note-math';
import { closestString, foldOctaveError, isTunerMode, matchString, tuningFor } from './tunings';
import { HINT_LABELS, computeReadout, formatCents, hintFor, needlePercent } from './tuner-view';

describe('tunings', () => {
  const guitar = tuningFor('guitar').strings;
  const bass5 = tuningFor('bass5').strings;
  const uke = tuningFor('ukulele').strings;

  it('defines the standard targets', () => {
    expect(guitar.map(m => midiToFrequency(m).toFixed(2))).toEqual(['82.41', '110.00', '146.83', '196.00', '246.94', '329.63']);
    expect(midiToFrequency(bass5[0]).toFixed(2)).toBe('30.87');
    expect(tuningFor('guitar-drop-d').strings[0]).toBe(38);
    expect(uke).toEqual([67, 60, 64, 69]);
  });

  it('auto-selects the closest string by cents', () => {
    expect(closestString(83, guitar, 440)!.index).toBe(0);
    const a = closestString(110 * Math.pow(2, 20 / 1200), guitar, 440)!;
    expect(a.index).toBe(1);
    expect(a.cents).toBeCloseTo(20, 4);
    expect(closestString(41.2, tuningFor('bass4').strings, 440)!.index).toBe(0);
    expect(closestString(41.2, bass5, 440)!.index).toBe(1);
    expect(closestString(31, bass5, 440)!.index).toBe(0);
  });

  it('reports unbounded cents for a badly detuned string', () => {
    // E string tuned down to about D (−200 cents) is still nearer to E2 than to A2.
    const m = closestString(73.42, guitar, 440)!;
    expect(m.index).toBe(0);
    expect(m.cents).toBeCloseTo(-200, 0);
  });

  it('matches a locked string even if another is closer', () => {
    const m = matchString(110, guitar, 0, 440)!;
    expect(m.index).toBe(0);
    expect(m.cents).toBeCloseTo(500, 0);
    expect(matchString(110, guitar, 9, 440)).toBeNull();
  });

  it('returns null without strings or with an invalid pitch', () => {
    expect(closestString(440, [], 440)).toBeNull();
    expect(closestString(0, guitar, 440)).toBeNull();
  });

  it('folds a 2× / ½× reading back to the string it was stable on', () => {
    const e2 = midiToFrequency(40);
    expect(foldOctaveError(164.82, guitar, 0, 82.4, 440)).toBeCloseTo(82.41, 1);
    expect(foldOctaveError(41.2, guitar, 0, 82.4, 440)).toBeCloseTo(82.4, 1);
    // Not stable on that string before → unchanged.
    expect(foldOctaveError(164.82, guitar, 0, 70, 440)).toBe(164.82);
    // Not an octave → unchanged (a real change of string).
    expect(foldOctaveError(110, guitar, 0, e2, 440)).toBe(110);
    expect(foldOctaveError(164.82, guitar, null, e2, 440)).toBe(164.82);
  });

  it('does not fold when the octave is another string (Drop D: D2 → D3)', () => {
    const dropD = tuningFor('guitar-drop-d').strings;
    expect(foldOctaveError(146.83, dropD, 0, 73.42, 440)).toBe(146.83);
  });

  it('validates modes and falls back to chromatic', () => {
    expect(isTunerMode('bass5')).toBeTrue();
    expect(isTunerMode('banjo')).toBeFalse();
    expect(tuningFor('nope' as never).id).toBe('chromatic');
  });
});

describe('tuner-view', () => {
  it('chromatic readout uses the nearest note', () => {
    const r = computeReadout({ frequency: 82.41, a4: 440, notation: 'es', strings: [], lockedString: null })!;
    expect(r).toEqual(jasmine.objectContaining({ name: 'Mi', octave: 2, target: null }));
  });

  it('instrument readout shows the sounding note plus the target string and cents vs it', () => {
    // D2 played on the low E string in Guitarra mode.
    const r = computeReadout({ frequency: 73.42, a4: 440, notation: 'es', strings: tuningFor('guitar').strings, lockedString: null })!;
    expect(r.name).toBe('Re');
    expect(r.octave).toBe(2);
    expect(r.cents).toBeCloseTo(-200, 0);
    expect(r.target).toEqual({ index: 0, number: 6, name: 'Mi', octave: 2 });
  });

  it('numbers strings from the highest (guitar thin E = 1, ukulele A = 1)', () => {
    const g = computeReadout({ frequency: 329.63, a4: 440, notation: 'es', strings: tuningFor('guitar').strings, lockedString: null })!;
    expect(g.target!.number).toBe(1);
    const u = computeReadout({ frequency: 392, a4: 440, notation: 'es', strings: tuningFor('ukulele').strings, lockedString: null })!;
    expect(u.target!.number).toBe(4);
  });

  it('hints: sharp → down (Baja), flat → up (Sube), "mucho" beyond 50 cents', () => {
    expect(hintFor(20, false)).toBe('down');
    expect(hintFor(-20, false)).toBe('up');
    expect(hintFor(-200, false)).toBe('way-up');
    expect(hintFor(51, false)).toBe('way-down');
    expect(HINT_LABELS['way-up']).toBe('Sube mucho (tensa)');
    expect(HINT_LABELS['way-down']).toBe('Baja mucho (afloja)');
    expect(hintFor(3, false)).toBe('close');
    expect(hintFor(6, true)).toBe('in-tune');
  });

  it('clamps the needle to ±50 cents', () => {
    expect(needlePercent(0)).toBe(0);
    expect(needlePercent(25)).toBe(50);
    expect(needlePercent(-300)).toBe(-100);
    expect(formatCents(-200.4)).toBe('−200 ¢');
    expect(formatCents(0.2)).toBe('±0 ¢');
  });
});
