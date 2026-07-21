const AVATAR_COLORS = [
  '#a0442a', '#c4623e', '#7a3320', '#b85040', '#8b3a2a', '#d4785a',
];

export function avatarColor(name: string): string {
  const code = name?.charCodeAt(0) ?? 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)}h`;
  if (mins < 10080) return `hace ${Math.floor(mins / 1440)}d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
