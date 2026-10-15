const AVATAR_COLORS = [
  // Every colour is ≥ 4.5:1 against the white initials (WCAG AA).
  '#141210', '#c23a1f', '#1d4d3a', '#23407a', '#5a2a5c', '#6b4a12',
];

export function avatarColor(name: string | null): string {
  const code = name?.charCodeAt(0) ?? 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

/** Widths Vercel resizes to; must match `images.sizes` in vercel.json. */
export const IMAGE_WIDTHS = [96, 192, 384, 640, 828, 1200] as const;

const STORAGE_PREFIX = 'https://yxaurffzwtqsckfmnzdj.supabase.co/storage/v1/object/public/';

/** Only the deployed site has Vercel's resizer; locally the original is used. */
function onVercel(host: string): boolean {
  return /(^|\.)bandyou\.es$|\.vercel\.app$/.test(host);
}

/**
 * A stored photo resized to about `width` CSS-pixels-times-two by Vercel, so a
 * 64 px circle downloads a few KB instead of the full upload (often 1600 px,
 * 500 KB). Other URLs, and any URL off the deployed site, come back unchanged.
 */
export function imageSrc(url: string | null | undefined, width: number,
                         host: string = typeof location === 'undefined' ? '' : location.hostname): string | null {
  if (!url) return null;
  if (!url.startsWith(STORAGE_PREFIX) || !onVercel(host)) return url;
  const w = IMAGE_WIDTHS.find(s => s >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=75`;
}

/** Square avatar of `size` device pixels. */
export function avatarSrc(url: string | null | undefined, size = 192): string | null {
  return imageSrc(url, size);
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'ahora';
  // "hace 1m" read as "1 mes": spell the units out.
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)} h`;
  if (mins < 10080) { const days = Math.floor(mins / 1440); return days === 1 ? 'ayer' : `hace ${days} días`; }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
