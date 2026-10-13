import { ShowcaseCard, bandCard, canPlay, musicianCard, profileLink, showcaseOrder } from './showcase';

const card = (key: string, over: Partial<ShowcaseCard> = {}): ShowcaseCard => ({
  key, kind: 'musician', id: key, user_id: 'u-' + key, name: key, role: null, genre: null, city: 'Madrid',
  avatar_url: null, looking_for: null, links: [], created_at: '2026-10-01T00:00:00Z', ...over,
});
const SONG = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC';

describe('Escaparate', () => {
  it('puts the visitor city first, then who can be heard, then who has a photo', () => {
    const cards = [
      card('far-song', { city: 'Bilbao', links: [SONG], avatar_url: 'x.jpg' }),
      card('here-plain'),
      card('here-photo', { avatar_url: 'x.jpg' }),
      card('here-song', { links: [SONG] }),
    ];
    expect(showcaseOrder(cards, 'madrid', null).map(c => c.key)).toEqual(['here-song', 'here-photo', 'here-plain', 'far-song']);
  });

  it('breaks ties by newest first', () => {
    const cards = [card('old', { created_at: '2026-01-01' }), card('new', { created_at: '2026-10-01' })];
    expect(showcaseOrder(cards, '', null).map(c => c.key)).toEqual(['new', 'old']);
  });

  it('never shows the visitor their own profile', () => {
    expect(showcaseOrder([card('a'), card('me', { user_id: 'me' })], '', 'me').map(c => c.key)).toEqual(['a']);
  });

  it('only counts links that can play inside the page', () => {
    expect(canPlay(card('a', { links: ['https://www.youtube.com/@canal'] }))).toBeFalse();
    expect(canPlay(card('b', { links: [null, SONG] }))).toBeTrue();
  });

  it('builds musician and band cards with the featured track first', () => {
    const m = musicianCard({ id: '1', user_id: 'u', name: 'Ana', instrument: 'Bajo', genre: 'Rock', city: 'Madrid', avatar_url: null,
      spotify_url: SONG, soundcloud_url: null, youtube_url: null, demo_url: 'https://youtu.be/abc', created_at: '' });
    expect(m.key).toBe('m-1');
    expect(m.role).toBe('Bajo');
    expect(m.links[0]).toBe('https://youtu.be/abc');
    expect(profileLink(m)).toEqual(['/musicians', '1']);

    const b = bandCard({ id: '2', user_id: 'u', name: 'Los Tal', genre: 'Punk', city: 'Madrid', avatar_url: null, looking_for: '  ',
      spotify_url: null, soundcloud_url: null, youtube_url: null, created_at: '' });
    expect(b.key).toBe('b-2');
    expect(b.looking_for).toBeNull();
    expect(profileLink(b)).toEqual(['/bands', '2']);
  });
});
