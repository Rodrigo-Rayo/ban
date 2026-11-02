import { citySlug, hubKindForPost, hubPath } from './hub-link';

describe('hub links', () => {
  it('slugs provinces like the server pages do', () => {
    expect(citySlug('A Coruña')).toBe('a-coruna');
    expect(citySlug('Santa Cruz de Tenerife')).toBe('santa-cruz-de-tenerife');
    expect(citySlug('Álava')).toBe('alava');
  });

  it('links to the province, or to all of Spain when it is not one', () => {
    expect(hubPath('musicos', 'Madrid')).toBe('/musicos/madrid');
    expect(hubPath('musicos', 'Otra')).toBe('/musicos');
    expect(hubPath('musicos', null)).toBe('/musicos');
    expect(hubPath('musicos', 'Pueblo inventado')).toBe('/musicos');
  });

  it('sends each ad to what it looks for', () => {
    expect(hubKindForPost('band_seeking_musician')).toBe('busco-banda');
    expect(hubKindForPost('musician_seeking_band')).toBe('busco-musicos');
    expect(hubKindForPost('collab')).toBe('busco-musicos');
    expect(hubKindForPost('looking_for_rehearsal')).toBe('locales-de-ensayo');
    expect(hubKindForPost('other')).toBe('busco-banda');
  });
});
