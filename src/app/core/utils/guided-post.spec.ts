import { composeGuidedText, firstKnown, guidedGroups, joinList, suggestTitle, toggleAnswer } from './guided-post';

describe('guided post', () => {
  it('only guides the two "busca" ads', () => {
    expect(guidedGroups('musician_seeking_band').length).toBeGreaterThan(0);
    expect(guidedGroups('band_seeking_musician').length).toBeGreaterThan(0);
    expect(guidedGroups('collab')).toEqual([]);
  });

  it('joins lists the Spanish way', () => {
    expect(joinList([], 'y')).toBe('');
    expect(joinList(['a'], 'y')).toBe('a');
    expect(joinList(['a', 'b'], 'o')).toBe('a o b');
    expect(joinList(['a', 'b', 'c'], 'y')).toBe('a, b y c');
  });

  it('writes one sentence per answered question, in order, plus the free line', () => {
    const text = composeGuidedText('musician_seeking_band', {
      have: ['gear', 'room'], want: ['stable'], when: ['weekend'],
    }, 'Influencias: Arctic Monkeys, Los Planetas');
    expect(text).toBe('Busco una banda estable. Puedo ensayar los fines de semana. Tengo local de ensayo y equipo propio. Influencias: Arctic Monkeys, Los Planetas.');
  });

  it('writes the band version', () => {
    expect(composeGuidedText('band_seeking_musician', { want: ['member', 'sub'], play: ['own'], now: ['live'] }))
      .toBe('Buscamos a alguien que se quede en la banda o un sustituto para algunos bolos. Hacemos temas propios. Ahora mismo tocamos en directo.');
  });

  it('is empty with nothing picked, and keeps the free line punctuation', () => {
    expect(composeGuidedText('musician_seeking_band', {})).toBe('');
    expect(composeGuidedText('musician_seeking_band', {}, '¿Hablamos?')).toBe('¿Hablamos?');
  });

  it('toggles chips without mutating', () => {
    const a = {};
    const b = toggleAnswer(a, 'want', 'stable');
    expect(b).toEqual({ want: ['stable'] });
    expect(a).toEqual({});
    expect(toggleAnswer(b, 'want', 'stable')).toEqual({ want: [] });
  });

  it('suggests a short title from the form fields', () => {
    expect(suggestTitle('musician_seeking_band', { instrument: 'Batería', genre: 'Rock', city: 'Madrid' })).toBe('Batería busca banda · Rock · Madrid');
    expect(suggestTitle('band_seeking_musician', { instrument: 'Bajo', city: 'Sevilla' })).toBe('Buscamos bajo · Sevilla');
    expect(suggestTitle('band_seeking_musician', {})).toBe('Buscamos músico');
    expect(suggestTitle('collab', { instrument: 'Bajo' })).toBe('');
    expect(suggestTitle('musician_seeking_band', { instrument: 'Batería', genre: 'Rock', city: 'Santa Cruz de Tenerife' }, 30))
      .toBe('Batería busca banda · Rock');
  });

  it('picks the first known value of a stored list', () => {
    expect(firstKnown('Voz, Guitarra', ['Guitarra', 'Bajo'])).toBe('Guitarra');
    expect(firstKnown(null, ['Guitarra'])).toBe('');
  });
});
