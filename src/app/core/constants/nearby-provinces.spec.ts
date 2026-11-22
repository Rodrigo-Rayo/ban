import { CITIES } from './cities';
import { NEARBY_PROVINCES, countNearby, nearbyProvinces } from './nearby-provinces';

describe('nearby provinces', () => {
  const provinces: string[] = CITIES.filter(c => c !== 'Otra');
  const bySea = ['Islas Baleares', 'Ceuta', 'Melilla'];

  it('covers every province with real province names', () => {
    expect(Object.keys(NEARBY_PROVINCES).sort()).toEqual([...provinces].sort());
    for (const near of Object.values(NEARBY_PROVINCES)) near.forEach(p => expect(provinces).toContain(p));
  });

  it('is mutual for land borders', () => {
    for (const [p, near] of Object.entries(NEARBY_PROVINCES)) {
      if (bySea.includes(p)) continue;
      near.filter(n => !bySea.includes(n)).forEach(n => expect(NEARBY_PROVINCES[n]).withContext(`${n} → ${p}`).toContain(p));
    }
  });

  it('has nothing for places outside Spain', () => {
    expect(nearbyProvinces('Pichincha, Ecuador')).toEqual([]);
    expect(nearbyProvinces('Otra')).toEqual([]);
  });

  it('counts the neighbours that have something, busiest first', () => {
    const rows = [{ city: 'Málaga' }, { city: 'Cádiz' }, { city: 'Málaga' }, { city: 'Madrid' }, { city: null }];
    expect(countNearby(rows, nearbyProvinces('Sevilla'))).toEqual([{ city: 'Málaga', n: 2 }, { city: 'Cádiz', n: 1 }]);
    expect(countNearby([], ['Cádiz'])).toEqual([]);
  });
});
