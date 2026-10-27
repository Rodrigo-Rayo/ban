import {
  AgendaEvent, applyQuickFilter, daysUntil, groupAgenda, isFree, posterTilt, posterTone, priceLabel, weekendOf, whenLabel,
} from './agenda';

const ev = (id: string, date: string, extra: Partial<AgendaEvent> = {}): AgendaEvent =>
  ({ id, title: 'T' + id, venue: 'Sala', city: 'Madrid', date, time: '21:00:00', genre: 'Rock', ...extra });

// 2026-10-27 is a Tuesday.
const TUE = '2026-10-27';

describe('agenda helpers', () => {
  it('finds the weekend of the week (the coming one from Monday to Thursday)', () => {
    expect(weekendOf(TUE)).toEqual({ from: '2026-10-30', to: '2026-11-01' });
    expect(weekendOf('2026-10-31')).toEqual({ from: '2026-10-30', to: '2026-11-01' });
    expect(weekendOf('2026-11-01')).toEqual({ from: '2026-10-30', to: '2026-11-01' });
  });

  it('counts days and says when', () => {
    expect(daysUntil('2026-10-30', TUE)).toBe(3);
    expect(whenLabel(TUE, TUE)).toBe('Hoy');
    expect(whenLabel('2026-10-28', TUE)).toBe('Mañana');
    expect(whenLabel('2026-10-30', TUE)).toBe('En 3 días');
    expect(whenLabel('2026-11-20', TUE)).toBe('');
  });

  it('reads prices', () => {
    expect(isFree('Gratis')).toBeTrue();
    expect(isFree('entrada libre')).toBeTrue();
    expect(isFree('0 €')).toBeTrue();
    expect(isFree('10')).toBeFalse();
    expect(priceLabel('10')).toBe('10 €');
    expect(priceLabel('6.5')).toBe('6.5 €');
    expect(priceLabel('libre')).toBe('Gratis');
    expect(priceLabel('10-15 € anticipada')).toBe('10-15 € anticipada');
    expect(priceLabel(null)).toBe('');
  });

  it('groups into Hoy, Este finde, Esta semana and months, skipping past days', () => {
    const groups = groupAgenda([
      ev('nov', '2026-11-21'),
      ev('wkd', '2026-10-31'),
      ev('old', '2026-10-20'),
      ev('tod', TUE),
      ev('wed', '2026-10-28'),
      ev('jan', '2027-01-28'),
    ], TUE);
    expect(groups.map(g => [g.label, g.events.map(e => e.id)])).toEqual([
      ['Hoy', ['tod']],
      ['Esta semana', ['wed']],
      ['Este finde', ['wkd']],
      ['Noviembre', ['nov']],
      ['Enero 2027', ['jan']],
    ]);
    expect(groups.find(g => g.key === 'weekend')!.hint).toBe('Del 30 oct al 1 nov');
  });

  it('keeps the same day in time order', () => {
    const g = groupAgenda([ev('late', '2026-11-21', { time: '23:00:00' }), ev('early', '2026-11-21', { time: '19:00:00' })], TUE);
    expect(g[0].events.map(e => e.id)).toEqual(['early', 'late']);
  });

  it('filters by today, weekend and free', () => {
    const list = [ev('a', TUE), ev('b', '2026-10-31', { price: 'Gratis' }), ev('c', '2026-11-21', { price: '10' })];
    expect(applyQuickFilter(list, 'today', TUE).map(e => e.id)).toEqual(['a']);
    expect(applyQuickFilter(list, 'weekend', TUE).map(e => e.id)).toEqual(['b']);
    expect(applyQuickFilter(list, 'free', TUE).map(e => e.id)).toEqual(['b']);
    expect(applyQuickFilter(list, 'all', TUE).length).toBe(3);
  });

  it('gives each posterless event a stable colour and each poster a small tilt', () => {
    expect(posterTone('abc')).toBe(posterTone('abc'));
    expect(Math.abs(posterTilt(7))).toBeLessThan(2);
  });
});
