import { cycleKey, drawAt, drawLabel, drawnCycles, eligibleDates, gigInstant, madridInstant, openCycle } from './quedada-cycle';

describe('quedada cycle', () => {
  it('converts Madrid wall-clock time in summer (UTC+2) and winter (UTC+1)', () => {
    expect(madridInstant(2026, 7, 20, 20).toISOString()).toBe('2026-07-20T18:00:00.000Z');
    expect(madridInstant(2026, 12, 20, 20).toISOString()).toBe('2026-12-20T19:00:00.000Z');
  });

  it('draws a month on day 20 of the month before, at 20:00 Madrid', () => {
    expect(drawAt({ year: 2026, month: 11 }).toISOString()).toBe('2026-10-20T18:00:00.000Z');
    expect(drawAt({ year: 2027, month: 1 }).toISOString()).toBe('2026-12-20T19:00:00.000Z');
    expect(drawLabel({ year: 2026, month: 11 })).toBe('20 de octubre');
  });

  it('signs up for next month until the 20th, and for the month after once it is drawn', () => {
    expect(cycleKey(openCycle(new Date('2026-10-05T12:00:00Z')))).toBe('2026-11-01');
    expect(cycleKey(openCycle(new Date('2026-10-20T17:59:00Z')))).toBe('2026-11-01');
    expect(cycleKey(openCycle(new Date('2026-10-20T18:01:00Z')))).toBe('2026-12-01');
    expect(cycleKey(openCycle(new Date('2026-12-28T12:00:00Z')))).toBe('2027-02-01');
  });

  it('shows this month’s winner, plus next month’s once drawn', () => {
    expect(drawnCycles(new Date('2026-10-05T12:00:00Z')).map(cycleKey)).toEqual(['2026-10-01']);
    expect(drawnCycles(new Date('2026-10-25T12:00:00Z')).map(cycleKey)).toEqual(['2026-10-01', '2026-11-01']);
  });

  it('accepts gigs from the 1st to the last day of the month', () => {
    expect(eligibleDates({ year: 2026, month: 2 })).toEqual(['2026-02-01', '2026-02-28']);
    expect(eligibleDates({ year: 2026, month: 11 })).toEqual(['2026-11-01', '2026-11-30']);
  });

  it('reads a gig time, defaulting to 21:00', () => {
    expect(gigInstant('2026-11-20', '22:30').toISOString()).toBe('2026-11-20T21:30:00.000Z');
    expect(gigInstant('2026-11-20', null).toISOString()).toBe('2026-11-20T20:00:00.000Z');
  });
});
