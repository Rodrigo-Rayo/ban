import { ChallengeEntry, challengePhase, challengeWinner, entryHost, isValidEntryUrl, rankEntries, timeLeft } from './reto';

const entry = (id: string, votes: number, created_at: string): ChallengeEntry => ({
  id, challenge_id: 'c', user_id: 'u' + id, url: 'https://youtu.be/x', caption: null,
  author_name: null, author_profile_type: null, author_profile_id: null, votes, created_at,
});

describe('reto', () => {
  const c = { entries_until: '2026-11-15T19:00:00Z', votes_until: '2026-11-22T19:00:00Z' };

  it('moves from entries to voting to closed', () => {
    expect(challengePhase(c, new Date('2026-11-01T00:00:00Z'))).toBe('entries');
    expect(challengePhase(c, new Date('2026-11-15T19:00:00Z'))).toBe('voting');
    expect(challengePhase(c, new Date('2026-11-22T19:00:01Z'))).toBe('closed');
  });

  it('ranks by votes, then by who entered first', () => {
    const list = [entry('a', 2, '2026-11-02'), entry('b', 5, '2026-11-03'), entry('c', 5, '2026-11-01')];
    expect(rankEntries(list).map(e => e.id)).toEqual(['c', 'b', 'a']);
    expect(list.map(e => e.id)).toEqual(['a', 'b', 'c']); // not mutated
  });

  it('has no winner without votes', () => {
    expect(challengeWinner([])).toBeNull();
    expect(challengeWinner([entry('a', 0, '2026-11-01')])).toBeNull();
    expect(challengeWinner([entry('a', 1, '2026-11-01')])?.id).toBe('a');
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
