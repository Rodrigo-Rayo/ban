const AVATAR_COLORS = [
  // Every colour is ≥ 4.5:1 against the white initials (WCAG AA).
  '#a0442a', '#a85a3c', '#7a3320', '#b85040', '#8b3a2a', '#a5502f',
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
  if (mins < 60) return `hace ${mins}m`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)}h`;
  if (mins < 10080) return `hace ${Math.floor(mins / 1440)}d`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
