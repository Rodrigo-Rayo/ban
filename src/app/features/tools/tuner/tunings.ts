import { centsBetween, midiToFrequency } from './note-math';

export type TunerMode = 'chromatic' | 'guitar' | 'guitar-drop-d' | 'bass4' | 'bass5' | 'ukulele';

export interface TuningDef {
  id: TunerMode;
  label: string;
  /** String targets as MIDI numbers, from the lowest (thickest) string, in playing order. */
  strings: readonly number[];
  /** Bass modes analyse a longer window so the lowest strings (B0 ≈ 30.9 Hz) are caught reliably. */
  bass: boolean;
}

// MIDI: E1=28 A1=33 B0=23 D2=38 G2=43 E2=40 A2=45 D3=50 G3=55 B3=59 E4=64 C4=60 A4=69 G4=67
export const TUNINGS: readonly TuningDef[] = [
  { id: 'chromatic', label: 'Cromático', strings: [], bass: false },
  { id: 'guitar', label: 'Guitarra', strings: [40, 45, 50, 55, 59, 64], bass: false },
  { id: 'guitar-drop-d', label: 'Guitarra Drop D', strings: [38, 45, 50, 55, 59, 64], bass: false },
  { id: 'bass4', label: 'Bajo 4 cuerdas', strings: [28, 33, 38, 43], bass: true },
  { id: 'bass5', label: 'Bajo 5 cuerdas', strings: [23, 28, 33, 38, 43], bass: true },
  // Re-entrant ukulele: the G string is the high G4, played first.
  { id: 'ukulele', label: 'Ukelele', strings: [67, 60, 64, 69], bass: false },
];

export function tuningFor(mode: TunerMode): TuningDef {
  return TUNINGS.find(t => t.id === mode) ?? TUNINGS[0];
}

export function isTunerMode(value: unknown): value is TunerMode {
  return typeof value === 'string' && TUNINGS.some(t => t.id === value);
}

export interface StringMatch {
  index: number;
  midi: number;
  target: number;
  /** Detected pitch relative to the string target, in cents (unbounded). */
  cents: number;
}

/** The string whose target is closest (in cents) to `frequency`. Null when there are no strings. */
export function closestString(frequency: number, strings: readonly number[], a4: number): StringMatch | null {
  if (!strings.length || !Number.isFinite(frequency) || frequency <= 0) return null;
  let best: StringMatch | null = null;
  strings.forEach((midi, index) => {
    const target = midiToFrequency(midi, a4);
    const cents = centsBetween(frequency, target);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { index, midi, target, cents };
  });
  return best;
}

/** Match against one specific string (the user locked it). */
export function matchString(frequency: number, strings: readonly number[], index: number, a4: number): StringMatch | null {
  const midi = strings[index];
  if (midi === undefined || !Number.isFinite(frequency) || frequency <= 0) return null;
  const target = midiToFrequency(midi, a4);
  return { index, midi, target, cents: centsBetween(frequency, target) };
}

/** An octave error is a reading within this many cents of 2× or ½× the string target. */
const OCTAVE_FOLD_CENTS = 40;
/** The previous stable pitch counts as "on that string" within this distance of its target. */
const ANCHOR_NEAR_CENTS = 100;
/** Don't fold when the octave reading is itself near another string (Drop D: D2 and D3). */
const OTHER_STRING_CENTS = 100;

/**
 * Detectors sometimes lock onto the 2nd harmonic (or a subharmonic) for a moment. If the pitch was
 * stable on string `anchorIndex` and the new reading is ≈ an octave away from that string, fold it
 * back to the string's octave instead of jumping. Returns `frequency` unchanged otherwise.
 */
export function foldOctaveError(
  frequency: number, strings: readonly number[], anchorIndex: number | null, previous: number | null, a4: number,
): number {
  if (anchorIndex === null || previous === null || strings[anchorIndex] === undefined) return frequency;
  const target = midiToFrequency(strings[anchorIndex], a4);
  if (Math.abs(centsBetween(previous, target)) > ANCHOR_NEAR_CENTS) return frequency;
  for (const factor of [2, 0.5]) {
    if (Math.abs(centsBetween(frequency, target * factor)) > OCTAVE_FOLD_CENTS) continue;
    const nearOther = strings.some((midi, i) =>
      i !== anchorIndex && Math.abs(centsBetween(frequency, midiToFrequency(midi, a4))) <= OTHER_STRING_CENTS);
    return nearOther ? frequency : frequency / factor;
  }
  return frequency;
}
