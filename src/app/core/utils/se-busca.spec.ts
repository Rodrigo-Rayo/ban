import { addDaysISO, askLabel, canBeUrgent, dateLabel, gigLabel, isValidGigDate, shareText } from './se-busca';

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

describe('Salvabolos and shared bills', () => {
  const today = '2026-10-08';

  it('offers Salvabolos only for gigs in the next 7 days', () => {
    expect(canBeUrgent('2026-10-08', today)).toBeTrue();
    expect(canBeUrgent('2026-10-15', today)).toBeTrue();
    expect(canBeUrgent('2026-10-16', today)).toBeFalse();
    expect(canBeUrgent('2026-10-07', today)).toBeFalse();
    expect(canBeUrgent('', today)).toBeFalse();
  });

  it('labels a shared bill as a cartel, a stand-in as a bolo', () => {
    expect(dateLabel('shared_bill', '2026-10-09', today)).toBe('Cartel mañana');
    expect(dateLabel('band_seeking_musician', '2026-10-09', today)).toBe('Bolo mañana');
    expect(dateLabel('shared_bill', null, today)).toBe('');
  });

  it('a shared bill looks for bands', () => {
    expect(askLabel('shared_bill')).toBe('Busca bandas');
  });
});
