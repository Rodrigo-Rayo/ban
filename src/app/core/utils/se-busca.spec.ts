import { addDaysISO, gigLabel, isValidGigDate, shareText } from './se-busca';

describe('shareText', () => {
  it('turns asks into a question for the group', () => {
    expect(shareText({ type: 'band_seeking_musician', instrument: 'Batería', title: 'Rock en Lavapiés', text: 'x', city: 'Madrid' }))
      .toBe('¿Conoces a alguien? Busca batería (Madrid): Rock en Lavapiés');
    expect(shareText({ type: 'musician_seeking_band', title: null, text: '  Guitarrista con ganas  ', city: null }))
      .toBe('¿Conoces a alguien? Busca banda: Guitarrista con ganas');
  });

  it('keeps offers as they are', () => {
    expect(shareText({ type: 'session_offer', title: 'Bajista para grabaciones', text: 'x', city: 'Madrid' }))
      .toBe('Bajista para grabaciones');
  });
});

describe('gig dates', () => {
  const today = '2026-10-08'; // a Thursday

  it('reads naturally: today, tomorrow, then weekday and date', () => {
    expect(gigLabel('2026-10-08', today)).toBe('Bolo hoy');
    expect(gigLabel('2026-10-09', today)).toBe('Bolo mañana');
    expect(gigLabel('2026-10-10', today)).toBe('Bolo el sáb 10 oct');
    expect(gigLabel(null, today)).toBe('');
  });

  it('accepts today up to 60 days ahead, nothing in the past', () => {
    expect(isValidGigDate('2026-10-08', today)).toBeTrue();
    expect(isValidGigDate(addDaysISO(today, 60), today)).toBeTrue();
    expect(isValidGigDate(addDaysISO(today, 61), today)).toBeFalse();
    expect(isValidGigDate('2026-10-07', today)).toBeFalse();
    expect(isValidGigDate('', today)).toBeFalse();
  });

  it('adds days across months', () => {
    expect(addDaysISO('2026-10-31', 1)).toBe('2026-11-01');
  });
});
