import { COUNTRIES } from '../constants/regions';
import { ALL_PLACES, OTHER_COUNTRY, OTHER_VALUE, PLACE_FILTER_GROUPS, SPAIN, isKnownPlace, isSpanishProvince, parsePlace, placeLabel, placeOption, placeValue, searchPlaces, whereCity } from './place';

describe('place', () => {
  it('stores Spanish provinces exactly as before', () => {
    expect(placeValue(SPAIN, 'Madrid')).toBe('Madrid');
    expect(parsePlace('Madrid')).toEqual({ country: SPAIN, region: 'Madrid' });
  });

  it('stores other countries as "region, country" and reads them back', () => {
    expect(placeValue('EC', 'Pichincha')).toBe('Pichincha, Ecuador');
    expect(parsePlace('Pichincha, Ecuador')).toEqual({ country: 'EC', region: 'Pichincha' });
    expect(parsePlace('Córdoba, Argentina')).toEqual({ country: 'AR', region: 'Córdoba' });
    expect(parsePlace('Córdoba')).toEqual({ country: SPAIN, region: 'Córdoba' });
  });

  it('keeps "Otra" for any other country', () => {
    expect(placeValue(OTHER_COUNTRY, '')).toBe(OTHER_VALUE);
    expect(parsePlace(OTHER_VALUE).country).toBe(OTHER_COUNTRY);
    expect(isKnownPlace(OTHER_VALUE)).toBeFalse();
  });

  it('treats unknown text as Spain with nothing picked', () => {
    expect(parsePlace('Narnia')).toEqual({ country: SPAIN, region: '' });
    expect(parsePlace('Narnia, Ecuador')).toEqual({ country: SPAIN, region: '' });
    expect(placeValue('EC', '')).toBe('');
  });

  it('knows which values are Spanish provinces', () => {
    expect(isSpanishProvince('Sevilla')).toBeTrue();
    expect(isSpanishProvince('Pichincha, Ecuador')).toBeFalse();
    expect(isSpanishProvince(OTHER_VALUE)).toBeFalse();
  });

  it('covers every Spanish-speaking country with unique, comma-free regions', () => {
    expect(COUNTRIES.length).toBe(20);
    for (const c of COUNTRIES) {
      expect(new Set(c.regions).size).toBe(c.regions.length);
      c.regions.forEach(r => expect(r).not.toContain(','));
    }
    expect(COUNTRIES.map(c => c.name)).toContain('Ecuador');
    expect(COUNTRIES.find(c => c.code === 'PR')!.regions.length).toBe(78);
  });

  it('filters by nothing, a whole country or one place', () => {
    const calls: string[] = [];
    const q = { eq: (c: string, v: string) => { calls.push(`eq ${c} ${v}`); return q; }, like: (c: string, v: string) => { calls.push(`like ${c} ${v}`); return q; } };
    whereCity(q, ALL_PLACES);
    whereCity(q, 'pais:AR');
    whereCity(q, 'Madrid');
    whereCity(q, 'pais:ZZ');
    expect(calls).toEqual(['like city %, Argentina', 'eq city Madrid']);
  });

  it('names a whole-country filter by the country', () => {
    expect(placeLabel('pais:AR')).toBe('Argentina');
    expect(placeLabel('Madrid')).toBe('Madrid');
    expect(placeLabel(OTHER_VALUE)).toBe('otro país');
  });

  it('finds places by what people type, ignoring accents and case', () => {
    const cor = searchPlaces('cor').map(o => o.value);
    expect(cor[0]).toBe('A Coruña');
    expect(cor).toContain('Córdoba');
    expect(cor).toContain('Córdoba, Argentina');
    expect(cor.indexOf('Córdoba')).toBeLessThan(cor.indexOf('Córdoba, Argentina'));
    expect(searchPlaces('MALAGA')[0].value).toBe('Málaga');
    expect(searchPlaces('   ')).toEqual([]);
    expect(searchPlaces('zzzz')).toEqual([]);
  });

  it('offers a whole country and its regions when its name is typed', () => {
    const ec = searchPlaces('ecuador', 100);
    expect(ec[0]).toEqual({ value: 'pais:EC', label: 'Todo Ecuador', group: 'Ecuador' });
    expect(ec.some(o => o.value === 'Pichincha, Ecuador')).toBeTrue();
    expect(searchPlaces('otro')[0].value).toBe(OTHER_VALUE);
  });

  it('caps the number of matches', () => {
    expect(searchPlaces('a').length).toBe(40);
    expect(searchPlaces('a', 5).length).toBe(5);
  });

  it('looks up an option with its group', () => {
    expect(placeOption('Jalisco, México')).toEqual({ value: 'Jalisco, México', label: 'Jalisco', group: 'México' });
    expect(placeOption('Narnia')).toBeUndefined();
  });

  it('offers all of Spain first and each country as a group', () => {
    expect(PLACE_FILTER_GROUPS[0].options[0].value).toBe(ALL_PLACES);
    expect(PLACE_FILTER_GROUPS.length).toBe(22);
    expect(PLACE_FILTER_GROUPS.find(g => g.label === 'Ecuador')!.options[0].value).toBe('pais:EC');
  });
});
