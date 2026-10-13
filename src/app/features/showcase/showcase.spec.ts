import {
  ShowcaseCard, bandCard, canPlay, cardSeconds, eventCard, favoriteId, favoriteType, gearCard, markSeen, musicianCard, postCard,
  progressWindow, readSeen, shortAgo, showcaseOrder, startAt,
} from './showcase';

const SONG = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC';
const card = (key: string, over: Partial<ShowcaseCard> = {}): ShowcaseCard => ({
  key, kind: 'musician', look: 'photo', kicker: '', title: key, subtitle: null, body: null, image: null, stamp: null,
  links: [], route: ['/musicians', key], routeLabel: 'Ver perfil', contactUserId: 'u-' + key, ownerId: 'u-' + key,
  city: 'Madrid', date: null, created_at: '2026-10-01T00:00:00Z', ...over,
});
/** Same "random" number every time: the bonuses decide the order. */
const flat = () => 0.5;

describe('Escaparate', () => {
  it('leans towards the visitor city, then cards that can be heard, then pictures', () => {
    const cards = [
      card('far-song', { city: 'Bilbao', links: [SONG], image: 'x.jpg' }),
      card('here-plain'),
      card('here-photo', { image: 'x.jpg' }),
      card('here-song', { links: [SONG] }),
    ];
    expect(showcaseOrder(cards, 'madrid', null, flat).map(c => c.key)).toEqual(['here-song', 'here-photo', 'far-song', 'here-plain']);
  });

  it('changes order from one visit to the next', () => {
    const cards = Array.from({ length: 12 }, (_, i) => card('c' + i));
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const a = showcaseOrder(cards, '', null, rnd).map(c => c.key).join();
    const b = showcaseOrder(cards, '', null, rnd).map(c => c.key).join();
    expect(a).not.toBe(b);
  });

  it('never shows the visitor their own things', () => {
    expect(showcaseOrder([card('a'), card('mine', { ownerId: 'me' })], '', 'me', flat).map(c => c.key)).toEqual(['a']);
  });

  it('never puts two Se busca cards together when it can avoid it', () => {
    const cards = [card('p1', { kind: 'post' }), card('p2', { kind: 'post' }), card('p3', { kind: 'post' }), card('m1'), card('m2')];
    const kinds = showcaseOrder(cards, '', null, flat).map(c => c.kind);
    for (let i = 1; i < kinds.length - 1; i++) expect(kinds[i] === 'post' && kinds[i - 1] === 'post').toBeFalse();
    expect(kinds.length).toBe(5);
  });

  it('starts at the card tapped on the home', () => {
    expect(startAt([card('a'), card('b'), card('c')], 'c').map(c => c.key)).toEqual(['c', 'a', 'b']);
    expect(startAt([card('a'), card('b')], 'zz').map(c => c.key)).toEqual(['a', 'b']);
  });

  it('only counts links that can play inside the page', () => {
    expect(canPlay(card('a', { links: ['https://www.youtube.com/@canal'] }))).toBeFalse();
    expect(canPlay(card('b', { links: [null, SONG] }))).toBeTrue();
  });

  it('builds a card for every kind of content', () => {
    const m = musicianCard({ id: '1', user_id: 'u', name: 'Ana', instrument: 'Bajo', genre: 'Rock', city: 'Madrid', avatar_url: null,
      spotify_url: SONG, soundcloud_url: null, youtube_url: null, demo_url: 'https://youtu.be/abc', created_at: '' });
    expect([m.key, m.kicker, m.links[0], m.route.join('/')]).toEqual(['m-1', 'Músico · Bajo · Madrid', 'https://youtu.be/abc', '/musicians/1']);

    const b = bandCard({ id: '2', user_id: 'u', name: 'Los Tal', genre: 'Punk', city: 'Madrid', avatar_url: null, looking_for: 'bajista',
      spotify_url: null, soundcloud_url: null, youtube_url: null, created_at: '' });
    expect(b.stamp).toBe('Buscan bajista');

    const e = eventCard({ id: '3', user_id: 'u', title: 'Los Tal en directo', venue: 'Sala El Perro', city: 'Madrid', date: '2026-11-21', time: '21:00:00', genre: 'Rock' });
    expect([e.look, e.kicker, e.contactUserId, e.date?.day]).toEqual(['gig', 'Concierto · Sala El Perro · Madrid', null, '21']);
    expect(e.subtitle).toContain('21:00');

    const p = postCard({ id: '4', user_id: 'u', type: 'band_seeking_musician', title: null, text: 'x'.repeat(300), city: 'Madrid', instrument: 'Batería', author_name: 'Los Tal', created_at: '' });
    expect([p.look, p.title, p.route.join('/')]).toEqual(['ask', 'Busca batería', '/posts/4']);
    expect(p.body!.length).toBeLessThanOrEqual(218);

    const g = gearCard({ id: '5', user_id: 'u', title: 'Fender Jazz Bass', price: 650, city: 'Madrid', images: ['a.jpg'], created_at: '' });
    expect([g.image, g.stamp, g.route.join('/')]).toEqual(['a.jpg', '650 €', '/shop/5']);
  });

  it('gives each card its time on screen: longer with music, a bit longer with text', () => {
    expect(cardSeconds(card('a'))).toBe(6);
    expect(cardSeconds(card('b', { body: 'Buscamos batería' }))).toBe(8);
    expect(cardSeconds(card('c', { links: [SONG] }))).toBe(15);
  });

  it('shows the story bars in blocks of ten around the current card', () => {
    expect(progressWindow(0, 0)).toEqual({ start: 0, count: 0 });
    expect(progressWindow(7, 3)).toEqual({ start: 0, count: 7 });
    expect(progressWindow(25, 12)).toEqual({ start: 10, count: 10 });
    expect(progressWindow(25, 21)).toEqual({ start: 20, count: 5 });
  });

  it('writes the time next to the name like stories', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    expect(shortAgo('2026-10-13T11:59:50Z', now)).toBe('ahora');
    expect(shortAgo('2026-10-13T11:40:00Z', now)).toBe('20 min');
    expect(shortAgo('2026-10-13T07:00:00Z', now)).toBe('5 h');
    expect(shortAgo('2026-10-11T12:00:00Z', now)).toBe('2 d');
    expect(shortAgo('2026-09-22T12:00:00Z', now)).toBe('3 sem');
    expect(shortAgo('nope', now)).toBe('');
  });

  it('only lets profiles and gigs be saved as favourites', () => {
    expect(favoriteType(card('m'))).toBe('musician');
    expect(favoriteType(card('e', { kind: 'event', route: ['/events', 'e9'] }))).toBe('event');
    expect(favoriteId(card('e', { kind: 'event', route: ['/events', 'e9'] }))).toBe('e9');
    expect(favoriteType(card('p', { kind: 'post' }))).toBeNull();
    expect(favoriteType(card('g', { kind: 'gear' }))).toBeNull();
  });

  it('remembers which cards were seen, newest last', () => {
    localStorage.removeItem('bandyou_showcase_seen');
    markSeen('m-1'); markSeen('b-2'); markSeen('m-1');
    expect([...readSeen()]).toEqual(['b-2', 'm-1']);
    localStorage.setItem('bandyou_showcase_seen', '{broken');
    expect(readSeen().size).toBe(0);
    localStorage.removeItem('bandyou_showcase_seen');
  });
});
