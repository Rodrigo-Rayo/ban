import { A4_DEFAULT, Notation, clampA4 } from './note-math';
import { TunerMode, isTunerMode } from './tunings';

export interface TunerSettings {
  a4: number;
  notation: Notation;
  mode: TunerMode;
}

const KEY = 'bandyou_tuner';
export const DEFAULT_SETTINGS: TunerSettings = { a4: A4_DEFAULT, notation: 'es', mode: 'chromatic' };

/** Reads saved settings; any missing, corrupt or blocked storage falls back to the defaults. */
export function loadSettings(storage: Pick<Storage, 'getItem'> | null = safeStorage()): TunerSettings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data = JSON.parse(raw) as Partial<Record<keyof TunerSettings, unknown>>;
    return {
      a4: typeof data.a4 === 'number' ? clampA4(data.a4) : A4_DEFAULT,
      notation: data.notation === 'en' ? 'en' : 'es',
      mode: isTunerMode(data.mode) ? data.mode : 'chromatic',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: TunerSettings, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode / quota: settings just won't persist.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
