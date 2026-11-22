import { Notation, frequencyToNote, midiOctave, noteName } from './note-math';
import { closestString, matchString } from './tunings';

/** What the tuner shows for one smoothed pitch. */
export interface TunerReadout {
  name: string;
  octave: number;
  frequency: number;
  /** Cents vs the target note (the nearest note, or the chosen string), unbounded. */
  cents: number;
  /** Index of the string being tuned in instrument modes, else null. */
  stringIndex: number | null;
}

export interface ReadoutInput {
  frequency: number;
  a4: number;
  notation: Notation;
  strings: readonly number[];
  /** String locked by the user, or null for automatic selection. */
  lockedString: number | null;
}

export function computeReadout({ frequency, a4, notation, strings, lockedString }: ReadoutInput): TunerReadout | null {
  if (strings.length) {
    const match = lockedString !== null
      ? matchString(frequency, strings, lockedString, a4)
      : closestString(frequency, strings, a4);
    if (!match) return null;
    return {
      name: noteName(match.midi, notation),
      octave: midiOctave(match.midi),
      frequency,
      cents: match.cents,
      stringIndex: match.index,
    };
  }
  const note = frequencyToNote(frequency, a4, notation);
  if (!note) return null;
  return { name: note.name, octave: note.octave, frequency, cents: note.cents, stringIndex: null };
}

export type TuneHint = 'in-tune' | 'close' | 'up' | 'down';

/**
 * Positive cents = sharp → loosen ("Baja"); negative = flat → tighten ("Sube").
 * "close" = inside the tolerance but not yet held long enough to count as in tune.
 */
export function hintFor(cents: number, inTune: boolean, tolerance = 5): TuneHint {
  if (inTune) return 'in-tune';
  if (Math.abs(cents) <= tolerance) return 'close';
  return cents > 0 ? 'down' : 'up';
}

/** Needle position in the −50…+50 cents scale, as a percentage of half the meter. */
export function needlePercent(cents: number): number {
  const clamped = Math.max(-50, Math.min(50, cents));
  return clamped * 2;
}
