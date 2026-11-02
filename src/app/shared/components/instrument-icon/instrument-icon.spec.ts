import { INSTRUMENTS } from '../../../core/constants/music.constants';
import { INSTRUMENT_ICONS, instrumentIconKey, instrumentIconSrc } from './instrument-icon';

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
  it('has its own image for every instrument', () => {
    const files = INSTRUMENTS.map(name => INSTRUMENT_ICONS[name]);
    files.forEach(file => expect(file).toMatch(/^[a-z]+$/));
    expect(new Set(files).size).toBe(INSTRUMENTS.length);
  });

  it('builds the path of the image, with the note for anything unknown', () => {
    expect(instrumentIconSrc('Batería, Voz')).toBe('/instruments/bateria.webp');
    expect(instrumentIconSrc('Contrabajo')).toBe('/instruments/contrabajo.webp');
    expect(instrumentIconSrc(null)).toBe('/instruments/otro.webp');
  });
});
