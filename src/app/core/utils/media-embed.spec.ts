import { firstEmbed, mediaEmbed } from './media-embed';

describe('mediaEmbed', () => {
  it('plays YouTube videos in every common link shape (privacy-enhanced domain)', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=Lmjfufz59mc',
      'https://youtu.be/Lmjfufz59mc?is=k6DOcwAJbgz6weby',
      'https://m.youtube.com/watch?v=Lmjfufz59mc&t=10',
      'https://youtube.com/shorts/Lmjfufz59mc',
      'https://music.youtube.com/watch?v=Lmjfufz59mc',
    ]) {
      const e = mediaEmbed(u);
      expect(e?.provider).withContext(u).toBe('YouTube');
      expect(e?.src).toBe('https://www.youtube-nocookie.com/embed/Lmjfufz59mc?autoplay=1&rel=0');
      expect(e?.height).toBeNull();
    }
  });

  it('does not try to play YouTube channels', () => {
    expect(mediaEmbed('https://www.youtube.com/@JulianCalvoDrums')).toBeNull();
    expect(mediaEmbed('https://youtube.com/@stormyrock?si=i4wQmoaALNk44czk')).toBeNull();
    expect(mediaEmbed('https://www.youtube.com/channel/UC123')).toBeNull();
  });

  it('plays Spotify artists, albums and tracks', () => {
    expect(mediaEmbed('https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF?si=abc'))
      .toEqual({ provider: 'Spotify', src: 'https://open.spotify.com/embed/artist/0OdUWJ0sBjDrqHygGUXeCF', height: 352 });
    expect(mediaEmbed('https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC')?.height).toBe(152);
    expect(mediaEmbed('https://open.spotify.com/user/someone')).toBeNull();
  });

  it('plays SoundCloud tracks and profiles, not site pages', () => {
    const track = mediaEmbed('https://soundcloud.com/banda/tema-uno?si=x');
    expect(track?.provider).toBe('SoundCloud');
    expect(track?.height).toBe(166);
    expect(track?.src).toContain(encodeURIComponent('https://soundcloud.com/banda/tema-uno'));
    expect(mediaEmbed('https://soundcloud.com/banda')?.height).toBe(300);
    expect(mediaEmbed('https://soundcloud.com/discover')).toBeNull();
    const page = mediaEmbed('https://soundcloud.com/banda/tracks');
    expect(page?.height).toBe(300);
    expect(page?.src).toContain(encodeURIComponent('https://soundcloud.com/banda') + '&');
  });

  it('rejects anything else, including tricky inputs', () => {
    for (const u of ['', null, 'nota-url', 'javascript:alert(1)', 'https://instagram.com/x',
      'https://youtube.com.evil.com/watch?v=Lmjfufz59mc', 'https://www.youtube.com/watch?v=<script>']) {
      expect(mediaEmbed(u)).withContext(String(u)).toBeNull();
    }
  });
});

describe('firstEmbed', () => {
  it('takes the first playable link in order', () => {
    expect(firstEmbed(['https://youtube.com/@canal', null, 'https://soundcloud.com/banda'])?.provider).toBe('SoundCloud');
    expect(firstEmbed(['https://instagram.com/x'])).toBeNull();
  });
});
