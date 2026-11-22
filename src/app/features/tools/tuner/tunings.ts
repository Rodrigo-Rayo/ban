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
