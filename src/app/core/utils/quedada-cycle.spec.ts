import { cycleKey, drawAt, drawnCycle, eligibleDates, gigInstant, madridInstant, openCycle } from './quedada-cycle';

describe('quedada cycle', () => {
  it('converts Madrid wall-clock time in summer (UTC+2) and winter (UTC+1)', () => {
    expect(madridInstant(2026, 7, 10, 20).toISOString()).toBe('2026-07-10T18:00:00.000Z');
    expect(madridInstant(2026, 12, 10, 20).toISOString()).toBe('2026-12-10T19:00:00.000Z');
  });

  it('draws on day 10 at 20:00 Madrid', () => {
    expect(drawAt({ year: 2026, month: 11 }).toISOString()).toBe('2026-11-10T19:00:00.000Z');
  });

  it('signs up for this month until the draw, and for next month after it', () => {
    expect(cycleKey(openCycle(new Date('2026-11-03T12:00:00Z')))).toBe('2026-11-01');
    expect(cycleKey(openCycle(new Date('2026-11-10T18:59:00Z')))).toBe('2026-11-01');
    expect(cycleKey(openCycle(new Date('2026-11-10T19:01:00Z')))).toBe('2026-12-01');
    expect(cycleKey(openCycle(new Date('2026-12-20T12:00:00Z')))).toBe('2027-01-01');
  });

  it('only shows a winner once this month has been drawn', () => {
    expect(drawnCycle(new Date('2026-11-05T12:00:00Z'))).toBeNull();
    expect(drawnCycle(new Date('2026-11-12T12:00:00Z'))).toEqual({ year: 2026, month: 11 });
  });

  it('accepts gigs from day 10 to the end of the month', () => {
    expect(eligibleDates({ year: 2026, month: 2 })).toEqual(['2026-02-10', '2026-02-28']);
    expect(eligibleDates({ year: 2026, month: 11 })).toEqual(['2026-11-10', '2026-11-30']);
  });

  it('reads a gig time, defaulting to 21:00', () => {
    expect(gigInstant('2026-11-20', '22:30').toISOString()).toBe('2026-11-20T21:30:00.000Z');
    expect(gigInstant('2026-11-20', null).toISOString()).toBe('2026-11-20T20:00:00.000Z');
  });
});
