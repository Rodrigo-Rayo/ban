import { INSTRUMENTS } from '../../../core/constants/music.constants';
import { INSTRUMENT_ICONS, instrumentIconKey } from './instrument-icon';

describe('instrumentIconKey', () => {
  it('resolves exact names', () => {
    expect(instrumentIconKey('Guitarra')).toBe('Guitarra');
    expect(instrumentIconKey('Batería')).toBe('Batería');
  });

  it('is case-insensitive', () => {
    expect(instrumentIconKey('BAJO')).toBe('Bajo');
    expect(instrumentIconKey('  voz ')).toBe('Voz');
  });

  it('works without accents', () => {
    expect(instrumentIconKey('bateria')).toBe('Batería');
    expect(instrumentIconKey('violin')).toBe('Violín');
    expect(instrumentIconKey('saxofon')).toBe('Saxofón');
    expect(instrumentIconKey('percusion')).toBe('Percusión');
  });

  it('uses the first known instrument of a comma list', () => {
    expect(instrumentIconKey('Guitarra, Bajo, Voz')).toBe('Guitarra');
    expect(instrumentIconKey('Otro, Bajo')).toBe('Bajo');
    expect(instrumentIconKey('Kazoo, flauta')).toBe('Flauta');
  });

  it('falls back for Otro, null, empty and unknown values', () => {
    expect(instrumentIconKey('Otro')).toBe('Otro');
    expect(instrumentIconKey(null)).toBe('Otro');
    expect(instrumentIconKey(undefined)).toBe('Otro');
    expect(instrumentIconKey('')).toBe('Otro');
    expect(instrumentIconKey('Kazoo')).toBe('Otro');
  });
});

describe('INSTRUMENT_ICONS', () => {
  it('has an icon for every instrument, distinct except Contrabajo, which shares the violin', () => {
    const markups = INSTRUMENTS.map(name => INSTRUMENT_ICONS[name]);
    markups.forEach(markup => expect(markup).toBeTruthy());
    expect(new Set(markups).size).toBe(INSTRUMENTS.length - 1);
    expect(INSTRUMENT_ICONS['Contrabajo']).toBe(INSTRUMENT_ICONS['Violín']);
  });

  it('only uses currentColor, no ids or masks', () => {
    for (const markup of Object.values(INSTRUMENT_ICONS)) {
      expect(markup).not.toMatch(/#[0-9a-f]{3,6}|\bid=|<mask|<clipPath|url\(/i);
    }
  });
});
