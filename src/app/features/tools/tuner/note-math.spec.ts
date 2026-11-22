import { A4_DEFAULT, centsBetween, clampA4, frequencyToNote, midiToFrequency, noteName } from './note-math';

describe('note-math', () => {
  it('maps 440 Hz to La4 with 0 cents', () => {
    const n = frequencyToNote(440)!;
    expect(n.name).toBe('La');
    expect(n.octave).toBe(4);
    expect(n.cents).toBeCloseTo(0, 6);
    expect(n.midi).toBe(69);
  });

  it('maps guitar low E 82.41 Hz to Mi2 within a cent', () => {
    const n = frequencyToNote(82.41)!;
    expect(`${n.name}${n.octave}`).toBe('Mi2');
    expect(Math.abs(n.cents)).toBeLessThan(1);
  });

  it('maps bass E 41.2 Hz to Mi1 and low B 30.87 Hz to Si0', () => {
    expect(frequencyToNote(41.2)).toEqual(jasmine.objectContaining({ name: 'Mi', octave: 1 }));
    const b = frequencyToNote(30.87)!;
    expect(`${b.name}${b.octave}`).toBe('Si0');
    expect(Math.abs(b.cents)).toBeLessThan(1);
  });

  it('octave boundary: C4 is Do4 and B3 is Si3', () => {
    expect(frequencyToNote(261.63)).toEqual(jasmine.objectContaining({ name: 'Do', octave: 4 }));
    expect(frequencyToNote(246.94)).toEqual(jasmine.objectContaining({ name: 'Si', octave: 3 }));
  });

  it('gives positive cents when sharp and negative when flat', () => {
    expect(frequencyToNote(445)!.cents).toBeGreaterThan(0);
    expect(frequencyToNote(435)!.cents).toBeLessThan(0);
    const detuned = frequencyToNote(110 * Math.pow(2, 20 / 1200))!;
    expect(detuned.name).toBe('La');
    expect(detuned.cents).toBeCloseTo(20, 6);
  });

  it('shifts with the reference: 442 Hz is in tune with A4 = 442 and 440 is flat', () => {
    expect(frequencyToNote(442, 442)!.cents).toBeCloseTo(0, 6);
    const flat = frequencyToNote(440, 442)!;
    expect(flat.name).toBe('La');
    expect(flat.cents).toBeCloseTo(centsBetween(440, 442), 6);
    expect(flat.cents).toBeLessThan(-7);
    expect(midiToFrequency(40, 442)).toBeCloseTo(82.78, 1);
  });

  it('supports English notation', () => {
    expect(frequencyToNote(440, A4_DEFAULT, 'en')!.name).toBe('A');
    expect(noteName(61, 'en')).toBe('C♯');
    expect(noteName(61, 'es')).toBe('Do♯');
  });

  it('rejects invalid frequencies', () => {
    expect(frequencyToNote(0)).toBeNull();
    expect(frequencyToNote(-5)).toBeNull();
    expect(frequencyToNote(NaN)).toBeNull();
  });

  it('clamps the reference to 415–466 and falls back to 440 on garbage', () => {
    expect(clampA4(400)).toBe(415);
    expect(clampA4(500)).toBe(466);
    expect(clampA4(441.4)).toBe(441);
    expect(clampA4(NaN)).toBe(440);
  });
});
