import { accountInitial, bandVacancyOption, PUBLISH_CONTENT, PUBLISH_PROFILES } from './navbar.component';

describe('navbar helpers', () => {
  describe('accountInitial()', () => {
    it('prefers the profile name over the email', () => {
      expect(accountInitial('Quique', 'carlos@example.com')).toBe('Q');
    });

    it('falls back to the email when there is no profile name', () => {
      expect(accountInitial('  ', 'carlos@example.com')).toBe('C');
      expect(accountInitial(null, 'carlos@example.com')).toBe('C');
    });

    it('uses "U" when nothing is known', () => {
      expect(accountInitial(null, undefined)).toBe('U');
    });
  });

  describe('bandVacancyOption()', () => {
    it('is hidden for non-band profiles', () => {
      expect(bandVacancyOption('musician', 'x')).toBeNull();
      expect(bandVacancyOption('', null)).toBeNull();
    });

    it('links to the band profile when the id is known', () => {
      expect(bandVacancyOption('band', 'b1')?.link).toBe('/bands/b1');
    });

    it('falls back to the panel without an id', () => {
      expect(bandVacancyOption('band', null)?.link).toBe('/dashboard');
    });
  });

  describe('publish groups', () => {
    it('lists content and professional profiles separately', () => {
      expect(PUBLISH_CONTENT.map(o => o.label)).toEqual(['Anuncio en Se busca', 'Concierto', 'Vender equipo']);
      expect(PUBLISH_PROFILES.map(o => o.label)).toEqual(['Dar clases', 'Local de ensayo', 'Sala de conciertos']);
    });
  });
});
