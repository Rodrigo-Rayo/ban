import { citySlug, genreHubLink, hubKindForPost, hubPath, instrumentHubLink } from './hub-link';

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

  it('links a profile to the page of its first instrument that has one, in its province', () => {
    expect(instrumentHubLink('Guitarra, Voz', 'Madrid')).toEqual({ href: '/busco/guitarrista/madrid', text: 'Guitarristas en Madrid' });
    expect(instrumentHubLink('Otro, Batería', 'A Coruña')).toEqual({ href: '/busco/bateria/a-coruna', text: 'Baterías en A Coruña' });
    expect(instrumentHubLink('Otro', 'Madrid')).toBeNull();
  });

  it('links a profile to the page of its first known style, matching "Funk / Soul" too', () => {
    expect(genreHubLink('Rock, Pop', 'Sevilla')).toEqual({ href: '/estilo/rock/sevilla', text: 'Bandas y músicos de rock en Sevilla' });
    expect(genreHubLink('Funk / Soul', 'Madrid')?.href).toBe('/estilo/funk-soul/madrid');
    expect(genreHubLink('Electrónica', 'Valencia')?.text).toBe('Bandas y músicos de música electrónica en Valencia');
    expect(genreHubLink('Bossa Nova', 'Madrid')).toBeNull();
  });

  it('adds no instrument or style links outside Spain, where those pages do not exist', () => {
    expect(instrumentHubLink('Guitarra', 'Pichincha, Ecuador')).toBeNull();
    expect(genreHubLink('Rock', 'Otra')).toBeNull();
    expect(genreHubLink('Rock', null)).toBeNull();
  });
});
