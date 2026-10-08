/**
 * Turns a profile's music link into an embeddable player, or null when the link
 * cannot play inside the page (a YouTube channel, Instagram, a personal site…).
 * Only exact, known URL shapes are accepted: the result goes into an iframe src.
 */
export interface MediaEmbed {
  provider: 'YouTube' | 'Spotify' | 'SoundCloud';
  src: string;
  /** Fixed player height in px; null = 16:9 video box. */
  height: number | null;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{22})\/?$/;
const SC_PATH = /^\/[A-Za-z0-9_-]+(?:\/(?:sets\/)?[A-Za-z0-9_-]+)?\/?$/;
const SC_RESERVED = new Set(['discover', 'search', 'upload', 'you', 'stream', 'charts', 'pages', 'settings', 'messages']);
/** Second path segments that are profile pages, not a track. */
const SC_PROFILE_PAGES = new Set(['tracks', 'likes', 'albums', 'reposts', 'popular-tracks', 'following', 'followers', 'sets']);

export function mediaEmbed(raw: string | null | undefined): MediaEmbed | null {
  let url: URL;
  try {
    url = new URL((raw ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');

  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/);
      id = m?.[1] ?? null;
    }
    if (!id || !YT_ID.test(id)) return null;
    return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, height: null };
  }

  if (host === 'open.spotify.com') {
    const m = url.pathname.match(SPOTIFY);
    if (!m) return null;
    const [, kind, id] = m;
    const compact = kind === 'track' || kind === 'episode';
    return { provider: 'Spotify', src: `https://open.spotify.com/embed/${kind}/${id}`, height: compact ? 152 : 352 };
  }

  if (host === 'soundcloud.com') {
    if (!SC_PATH.test(url.pathname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (SC_RESERVED.has(parts[0].toLowerCase())) return null;
    const profilePage = parts.length === 2 && SC_PROFILE_PAGES.has(parts[1].toLowerCase());
    const single = parts.length === 2 && !profilePage;
    const clean = `https://soundcloud.com/${(profilePage ? parts.slice(0, 1) : parts).join('/')}`;
    return {
      provider: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&auto_play=true&visual=false&show_comments=false`,
      height: single ? 166 : 300,
    };
  }

  return null;
}

/** The first link (in the given order) that can play inside the page. */
export function firstEmbed(urls: readonly (string | null | undefined)[]): MediaEmbed | null {
  for (const u of urls) {
    const e = mediaEmbed(u);
    if (e) return e;
  }
  return null;
}
