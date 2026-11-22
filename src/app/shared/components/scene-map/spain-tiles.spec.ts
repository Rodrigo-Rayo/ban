import { CITIES } from '../../../core/constants/cities';
import { SPAIN_COLS, SPAIN_ROWS, SPAIN_TILES } from './spain-tiles';

describe('SPAIN_TILES', () => {
  const provinces = CITIES.filter(c => c !== 'Otra') as readonly string[];

  it('has every one of the 52 provinces exactly once', () => {
    const names = SPAIN_TILES.map(t => t.name);
    expect(names.length).toBe(52);
    expect(new Set(names).size).toBe(52);
    expect([...names].sort()).toEqual([...provinces].sort());
  });

  it('puts each tile on its own cell inside the grid', () => {
    const cells = SPAIN_TILES.map(t => `${t.col},${t.row}`);
    expect(new Set(cells).size).toBe(SPAIN_TILES.length);
    for (const t of SPAIN_TILES) {
      expect(t.col).toBeGreaterThanOrEqual(0);
      expect(t.col).toBeLessThan(SPAIN_COLS);
      expect(t.row).toBeGreaterThanOrEqual(0);
      expect(t.row).toBeLessThan(SPAIN_ROWS);
    }
  });

  it('gives every tile a unique short code', () => {
    const codes = SPAIN_TILES.map(t => t.code);
    expect(new Set(codes).size).toBe(52);
    expect(codes.every(c => /^[A-Z]{1,2}$/.test(c))).toBeTrue();
  });

  it('fills every row, so the map height never depends on data', () => {
    for (let r = 0; r < SPAIN_ROWS; r++) expect(SPAIN_TILES.some(t => t.row === r)).toBeTrue();
  });
});
