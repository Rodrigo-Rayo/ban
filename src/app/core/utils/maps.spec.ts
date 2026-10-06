import { mapsUrl } from './maps';

describe('mapsUrl', () => {
  const query = (url: string) => new URL(url).searchParams.get('query');

  it('searches Google Maps for venue, address and province', () => {
    const url = mapsUrl(['Sala El Sótano', 'C/ de la Palma 12', 'Madrid']);
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBeTrue();
    expect(query(url)).toBe('Sala El Sótano, C/ de la Palma 12, Madrid, España');
  });

  it('skips missing or blank parts', () => {
    expect(query(mapsUrl(['Sala Luna', null, '  ', undefined, 'Islas Baleares']))).toBe('Sala Luna, Islas Baleares, España');
  });

  it('encodes characters that would break the URL', () => {
    expect(mapsUrl(['Bar & Co #2'])).toContain('Bar%20%26%20Co%20%232');
  });
});
