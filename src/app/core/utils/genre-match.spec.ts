import { genrePattern } from './genre-match';

describe('genrePattern', () => {
  const matches = (genre: string, stored: string) => new RegExp(genrePattern(genre), 'i').test(stored);

  it('matches a genre anywhere in the comma-separated list', () => {
    expect(matches('Rap', 'Rap')).toBeTrue();
    expect(matches('Rap', 'Rock, Rap, Funk / Soul')).toBeTrue();
    expect(matches('rap', 'Indie,RAP')).toBeTrue();
    expect(matches('Funk / Soul', 'Rock, Funk / Soul')).toBeTrue();
  });

  it('does not match a genre that only appears inside another one', () => {
    expect(matches('Rap', 'Trap / Urbano')).toBeFalse();
    expect(matches('Rock', 'Hard Rock')).toBeFalse();
    expect(matches('Pop', 'Pop-rock')).toBeFalse();
  });

  it('escapes regex characters in the genre name', () => {
    expect(matches('Trap / Urbano', 'Trap / Urbano, Rap')).toBeTrue();
    expect(matches('a.b', 'axb')).toBeFalse();
  });
});
