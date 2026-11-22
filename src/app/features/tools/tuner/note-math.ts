/** Pure note math for the tuner: no Angular, no Web Audio. */

export type Notation = 'es' | 'en';

export const A4_DEFAULT = 440;
export const A4_MIN = 415;
export const A4_MAX = 466;

/** MIDI number of A4. Octaves follow scientific pitch notation (A4 = 440 Hz, C4 = middle C). */
const A4_MIDI = 69;

const NAMES: Record<Notation, readonly string[]> = {
  es: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'],
  en: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};

export interface NoteInfo {
  midi: number;
  /** Note name without octave, e.g. "Mi" or "E". */
  name: string;
  octave: number;
  /** Deviation from the nearest equal-tempered note, in cents (−50…+50). Positive = sharp. */
  cents: number;
  /** Frequency of the nearest note, in Hz. */
  target: number;
}

/** Clamps the reference pitch to the supported range; anything invalid falls back to 440. */
export function clampA4(a4: number): number {
  if (!Number.isFinite(a4)) return A4_DEFAULT;
  return Math.min(A4_MAX, Math.max(A4_MIN, Math.round(a4)));
}

export function midiToFrequency(midi: number, a4 = A4_DEFAULT): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Signed distance from `reference` to `frequency`, in cents. */
export function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

export function noteName(midi: number, notation: Notation = 'es'): string {
  return NAMES[notation][((midi % 12) + 12) % 12];
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** Nearest equal-tempered note to `frequency`. Returns null for non-positive or non-finite input. */
export function frequencyToNote(frequency: number, a4 = A4_DEFAULT, notation: Notation = 'es'): NoteInfo | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const exact = A4_MIDI + 12 * Math.log2(frequency / a4);
  const midi = Math.round(exact);
  const target = midiToFrequency(midi, a4);
  return {
    midi,
    name: noteName(midi, notation),
    octave: midiOctave(midi),
    cents: centsBetween(frequency, target),
    target,
  };
}
