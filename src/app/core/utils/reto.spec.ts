import { challengePhase, entryHost, isValidEntryUrl, timeLeft } from './reto';

describe('reto', () => {
  const c = { entries_until: '2026-11-15T19:00:00Z' };

  it('is open until entries close', () => {
    expect(challengePhase(c, new Date('2026-11-01T00:00:00Z'))).toBe('entries');
    expect(challengePhase(c, new Date('2026-11-15T19:00:00Z'))).toBe('closed');
  });

  it('says how long is left', () => {
    const now = new Date('2026-11-10T19:00:00Z');
    expect(timeLeft('2026-11-15T19:00:00Z', now)).toBe('Quedan 5 días');
    expect(timeLeft('2026-11-10T20:30:00Z', now)).toBe('Quedan 1 hora');
    expect(timeLeft('2026-11-10T19:10:00Z', now)).toBe('Quedan unos minutos');
    expect(timeLeft('2026-11-10T18:00:00Z', now)).toBe('');
  });

  it('accepts https links from video and audio sites only', () => {
    expect(entryHost('https://www.instagram.com/reel/abc/')).toBe('Instagram');
    expect(entryHost('https://vm.tiktok.com/xyz')).toBe('TikTok');
    expect(entryHost('https://m.youtube.com/watch?v=1')).toBe('YouTube');
    expect(isValidEntryUrl('https://youtu.be/abc')).toBeTrue();
    expect(isValidEntryUrl('http://youtu.be/abc')).toBeFalse();
    expect(isValidEntryUrl('https://evil-youtube.com/x')).toBeFalse();
    expect(isValidEntryUrl('javascript:alert(1)')).toBeFalse();
    expect(isValidEntryUrl('https://youtu.be/' + 'a'.repeat(300))).toBeFalse();
  });
});
