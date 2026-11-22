import {
  DEFAULT_SETTINGS, STORAGE_KEY, clampBpm, groupStarts, levelForStep, loadSettings, meterById, saveSettings,
  sanitizeSettings, secondsPerStep, stepsPerBar, tempoName,
} from './metronome-model';
import { TAP_RESET_MS, TapTempo } from './tap-tempo';

describe('metronome model', () => {
  it('clamps BPM to 30–300 and rounds', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(120.6)).toBe(121);
    expect(clampBpm(NaN)).toBe(120);
  });

  it('names tempos in Italian', () => {
    expect(tempoName(50)).toBe('Largo');
    expect(tempoName(70)).toBe('Adagio');
    expect(tempoName(90)).toBe('Andante');
    expect(tempoName(112)).toBe('Moderato');
    expect(tempoName(130)).toBe('Allegro');
    expect(tempoName(190)).toBe('Presto');
    expect(tempoName(260)).toBe('Prestissimo');
  });

  it('counts eighths in x/8 and ignores subdivisions there', () => {
    const m68 = meterById('6/8');
    expect(stepsPerBar(m68, 4)).toBe(6);
    expect(secondsPerStep(120, m68, 4)).toBe(0.5);
    expect(stepsPerBar(meterById('4/4'), 3)).toBe(12);
    expect(groupStarts(meterById('7/8'))).toEqual([0, 2, 4]);
    expect(levelForStep(meterById('3/4'), 3, 4, true)).toBe('sub');
  });

  it('sanitizes untrusted stored settings field by field', () => {
    expect(sanitizeSettings({ bpm: 500, meter: '9/8', subdivision: 7, sound: 'cowbell', volume: 3, accent: 'yes' }))
      .toEqual({ ...DEFAULT_SETTINGS, bpm: 300, volume: 1 });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('persists and restores settings, surviving broken or throwing storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const s = { bpm: 88, meter: '7/8' as const, subdivision: 3 as const, sound: 'wood' as const, volume: 0.3, accent: false };
    saveSettings(storage, s);
    expect(loadSettings(storage)).toEqual(s);
    store.set(STORAGE_KEY, '{not json');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(throwing, s)).not.toThrow();
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('TapTempo', () => {
  const tapAt = (t: TapTempo, times: number[]) => times.map(x => t.tap(x)).pop();

  it('needs two taps, then averages steady intervals', () => {
    const t = new TapTempo();
    expect(t.tap(0)).toBeNull();
    expect(t.tap(500)).toBe(120);
    expect(tapAt(t, [1000, 1500, 2000])).toBe(120);
  });

  it('averages slightly uneven taps', () => {
    expect(tapAt(new TapTempo(), [0, 490, 1000, 1495, 2005])).toBe(120);
  });

  it('ignores a double tap or a missed tap as outliers', () => {
    const afterDouble = tapAt(new TapTempo(), [0, 500, 1000, 1500, 1520, 2000, 2500])!;
    expect(Math.abs(afterDouble - 120)).toBeLessThanOrEqual(1); // the 20 ms interval is dropped
    expect(tapAt(new TapTempo(), [0, 500, 1000, 2000, 2500, 3000])).toBe(120);
  });

  it('resets after a long pause', () => {
    const t = new TapTempo();
    tapAt(t, [0, 1000, 2000]); // 60 bpm
    expect(t.tap(2000 + TAP_RESET_MS + 1)).toBeNull();
    expect(t.tap(2000 + TAP_RESET_MS + 401)).toBe(150);
  });

  it('follows a new tempo after a few taps (window of recent intervals)', () => {
    const t = new TapTempo();
    tapAt(t, [0, 600, 1200, 1800, 2400, 3000, 3600]); // 100 bpm
    expect(tapAt(t, [4000, 4400, 4800, 5200, 5600])).toBe(150);
  });

  it('clamps to the BPM range', () => {
    expect(tapAt(new TapTempo(), [0, 100, 200])).toBe(300);
  });
});
