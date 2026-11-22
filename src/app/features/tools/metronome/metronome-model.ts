import seoData from './metronome-seo.json';
/**
 * Pure metronome model: meters, accent patterns, tempo names and persisted settings.
 * No DOM or Web Audio here, so every rule is unit-testable.
 */

export const BPM_MIN = 30;
export const BPM_MAX = 300;

export type MeterId = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '12/8';
export type Subdivision = 1 | 2 | 3 | 4;
export type SoundId = 'click' | 'wood';
/** accent = first click of the bar, beat = a counted beat (or group start in x/8), sub = soft tick. */
export type ClickLevel = 'accent' | 'beat' | 'sub';

export interface Meter {
  id: MeterId;
  /** Clicks per bar at subdivision 1: quarter notes in x/4, eighth notes in x/8. */
  pulses: number;
  /** Group sizes for compound/odd x/8 meters; the first pulse of each group is stressed. */
  groups: readonly number[] | null;
}

/**
 * In x/8 meters every click is an eighth note (the BPM counts eighths) and the bar is
 * stressed on its groups: 6/8 = 3+3, 7/8 = 2+2+3, 12/8 = 3+3+3+3. Subdivisions only
 * apply to x/4 meters.
 */
export const METERS: readonly Meter[] = [
  { id: '2/4', pulses: 2, groups: null },
  { id: '3/4', pulses: 3, groups: null },
  { id: '4/4', pulses: 4, groups: null },
  { id: '5/4', pulses: 5, groups: null },
  { id: '6/8', pulses: 6, groups: [3, 3] },
  { id: '7/8', pulses: 7, groups: [2, 2, 3] },
  { id: '12/8', pulses: 12, groups: [3, 3, 3, 3] },
];

export const SUBDIVISIONS: readonly { value: Subdivision; label: string }[] = [
  { value: 1, label: 'Negras' },
  { value: 2, label: 'Corcheas' },
  { value: 3, label: 'Tresillos' },
  { value: 4, label: 'Semicorcheas' },
];

export const SOUNDS: readonly { value: SoundId; label: string }[] = [
  { value: 'click', label: 'Clic' },
  { value: 'wood', label: 'Madera' },
];

export function meterById(id: MeterId): Meter {
  return METERS.find(m => m.id === id) ?? METERS[2];
}

export function isCompound(meter: Meter): boolean {
  return meter.groups !== null;
}

/** Subdivision actually used: x/8 meters always click on every eighth. */
export function effectiveSubdivision(meter: Meter, sub: Subdivision): Subdivision {
  return isCompound(meter) ? 1 : sub;
}

export function stepsPerBar(meter: Meter, sub: Subdivision): number {
  return meter.pulses * effectiveSubdivision(meter, sub);
}

export function secondsPerStep(bpm: number, meter: Meter, sub: Subdivision): number {
  return 60 / bpm / effectiveSubdivision(meter, sub);
}

/** Indexes (0-based pulses) where each group starts, e.g. 7/8 → [0, 2, 4]. */
export function groupStarts(meter: Meter): number[] {
  if (!meter.groups) return Array.from({ length: meter.pulses }, (_, i) => i);
  const starts: number[] = [];
  let at = 0;
  for (const g of meter.groups) { starts.push(at); at += g; }
  return starts;
}

/** Sound level of a step within the bar. */
export function levelForStep(meter: Meter, sub: Subdivision, step: number, accent: boolean): ClickLevel {
  const subs = effectiveSubdivision(meter, sub);
  if (step % subs !== 0) return 'sub';
  const pulse = step / subs;
  if (pulse === 0) return accent ? 'accent' : 'beat';
  if (!meter.groups) return 'beat';
  return groupStarts(meter).includes(pulse) ? 'beat' : 'sub';
}

/** The pulse (beat square) a step belongs to. */
export function pulseForStep(meter: Meter, sub: Subdivision, step: number): number {
  return Math.floor(step / effectiveSubdivision(meter, sub));
}

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

const TEMPO_NAMES: readonly [number, string][] = [
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [156, 'Allegro'],
  [176, 'Vivace'],
  [200, 'Presto'],
  [Infinity, 'Prestissimo'],
];

/** Italian tempo marking for a BPM (approximate; ranges overlap in practice). */
export function tempoName(bpm: number): string {
  return TEMPO_NAMES.find(([max]) => bpm < max)?.[1] ?? 'Prestissimo';
}

/** Ranges shown in the page's reference table (copy lives in metronome-seo.json). */
export const TEMPO_TABLE: readonly { name: string; range: string; feel: string }[] = seoData.tempoTable;

export interface MetronomeSettings {
  bpm: number;
  meter: MeterId;
  subdivision: Subdivision;
  sound: SoundId;
  /** Master volume 0–1. */
  volume: number;
  accent: boolean;
}

export const DEFAULT_SETTINGS: MetronomeSettings = {
  bpm: 100, meter: '4/4', subdivision: 1, sound: 'click', volume: 0.8, accent: true,
};

export const STORAGE_KEY = 'bandyou_metronome';

/** Validates untrusted stored data field by field, falling back to defaults. */
export function sanitizeSettings(raw: unknown): MetronomeSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const meter = METERS.some(m => m.id === o['meter']) ? (o['meter'] as MeterId) : DEFAULT_SETTINGS.meter;
  const sub = [1, 2, 3, 4].includes(o['subdivision'] as number) ? (o['subdivision'] as Subdivision) : DEFAULT_SETTINGS.subdivision;
  const sound = o['sound'] === 'click' || o['sound'] === 'wood' ? o['sound'] : DEFAULT_SETTINGS.sound;
  const vol = typeof o['volume'] === 'number' && Number.isFinite(o['volume']) ? Math.min(1, Math.max(0, o['volume'])) : DEFAULT_SETTINGS.volume;
  const bpm = typeof o['bpm'] === 'number' ? clampBpm(o['bpm']) : DEFAULT_SETTINGS.bpm;
  const accent = typeof o['accent'] === 'boolean' ? o['accent'] : DEFAULT_SETTINGS.accent;
  return { bpm, meter, subdivision: sub, sound, volume: vol, accent };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null): MetronomeSettings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | null, settings: MetronomeSettings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / quota: the metronome still works, it just won't remember.
  }
}
