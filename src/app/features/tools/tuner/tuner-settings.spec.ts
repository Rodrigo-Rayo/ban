import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './tuner-settings';

describe('tuner-settings', () => {
  const store = (raw: string | null) => ({ getItem: () => raw });

  it('falls back to defaults for missing, corrupt or throwing storage', () => {
    expect(loadSettings(store(null))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(store('{nope'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('sanitises stored values', () => {
    expect(loadSettings(store(JSON.stringify({ a4: 999, notation: 'xx', mode: 'banjo' }))))
      .toEqual({ a4: 466, notation: 'es', mode: 'chromatic' });
    expect(loadSettings(store(JSON.stringify({ a4: 442, notation: 'en', mode: 'bass5' }))))
      .toEqual({ a4: 442, notation: 'en', mode: 'bass5' });
  });

  it('round-trips and survives a throwing setItem', () => {
    let saved = '';
    saveSettings({ a4: 441, notation: 'en', mode: 'ukulele' }, { setItem: (_k: string, v: string) => { saved = v; } });
    expect(loadSettings(store(saved))).toEqual({ a4: 441, notation: 'en', mode: 'ukulele' });
    expect(() => saveSettings(DEFAULT_SETTINGS, { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });
});
