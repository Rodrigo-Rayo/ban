const AVATAR_COLORS = [
  // Every colour is ≥ 4.5:1 against the white initials (WCAG AA).
  '#141210', '#c23a1f', '#1d4d3a', '#23407a', '#5a2a5c', '#6b4a12',
];

export function avatarColor(name: string | null): string {
  const code = name?.charCodeAt(0) ?? 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function avatarSrc(url: string | null | undefined, size = 200): string | null {
  if (!url) return null;
  if (!url.includes('supabase.co/storage')) return url;
  return `${url}?width=${size}&height=${size}&resize=cover&quality=80&format=webp`;
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
