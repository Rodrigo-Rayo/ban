import { posterNameSize } from './poster-name';

describe('posterNameSize', () => {
  it('keeps the big poster type for short names', () => {
    expect(posterNameSize('Stormy')).toContain('11vw');
  });

  it('shrinks step by step as names get longer', () => {
    expect(posterNameSize('Regreso a Venus')).toContain('8.5vw');
    expect(posterNameSize('Gusanos en tu Alcoba de Noche')).toContain('7vw');
    expect(posterNameSize('Who killed the banjo? Barcelona Country Band')).toContain('6.25vw');
  });

  it('treats one long unbreakable word as a longer name', () => {
    expect(posterNameSize('CompositorMusicalConIA')).toContain('7vw');
    expect(posterNameSize('Fitosfera')).toContain('11vw');
  });

  it('copes with empty names', () => {
    expect(posterNameSize(null)).toContain('11vw');
  });
});
