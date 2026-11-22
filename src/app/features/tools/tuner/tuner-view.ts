import { Notation, frequencyToNote, midiOctave, noteName } from './note-math';
import { closestString, matchString } from './tunings';

/** The string being tuned in instrument modes. */
export interface StringTarget {
  index: number;
  /** Conventional string number: 1 = highest-pitched string (guitar: thin E). */
  number: number;
  name: string;
  octave: number;
}

/** What the tuner shows for one smoothed pitch. */
export interface TunerReadout {
  /** The note actually sounding (always the nearest note, also in instrument modes). */
  name: string;
  octave: number;
  frequency: number;
  /** Cents vs the target: the nearest note (chromatic) or the string (instrument modes); unbounded. */
  cents: number;
  /** Instrument modes: the string being tuned. Null in chromatic mode. */
  target: StringTarget | null;
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
  const note = frequencyToNote(frequency, a4, notation);
  if (!note) return null;
  if (!strings.length) {
    return { name: note.name, octave: note.octave, frequency, cents: note.cents, target: null };
  }
  const match = lockedString !== null
    ? matchString(frequency, strings, lockedString, a4)
    : closestString(frequency, strings, a4);
  if (!match) return null;
  return {
    name: note.name,
    octave: note.octave,
    frequency,
    cents: match.cents,
    target: {
      index: match.index,
      number: strings.length - match.index,
      name: noteName(match.midi, notation),
      octave: midiOctave(match.midi),
    },
  };
}

export type TuneHint = 'in-tune' | 'close' | 'up' | 'down' | 'way-up' | 'way-down';

/** Beyond this the needle is pinned at the edge and the cue says "mucho". */
export const FAR_CENTS = 50;

/**
 * Positive cents = sharp → loosen ("Baja"); negative = flat → tighten ("Sube").
 * "close" = inside the tolerance but not yet held long enough to count as in tune.
 */
export function hintFor(cents: number, inTune: boolean, tolerance = 5): TuneHint {
  if (inTune) return 'in-tune';
  const abs = Math.abs(cents);
  if (abs <= tolerance) return 'close';
  if (abs > FAR_CENTS) return cents > 0 ? 'way-down' : 'way-up';
  return cents > 0 ? 'down' : 'up';
}

export const HINT_LABELS: Record<TuneHint, string> = {
  'in-tune': 'Afinada',
  close: 'Casi',
  up: 'Sube (tensa)',
  down: 'Baja (afloja)',
  'way-up': 'Sube mucho (tensa)',
  'way-down': 'Baja mucho (afloja)',
};

/** Needle position in the −50…+50 cents scale, as a percentage of half the meter (pinned beyond). */
export function needlePercent(cents: number): number {
  const clamped = Math.max(-FAR_CENTS, Math.min(FAR_CENTS, cents));
  return clamped * 2;
}

/** "+12 ¢" / "−200 ¢" / "±0 ¢" with a real minus sign. */
export function formatCents(cents: number): string {
  const c = Math.round(cents);
  return `${c > 0 ? '+' : c < 0 ? '−' : '±'}${Math.abs(c)} ¢`;
}
