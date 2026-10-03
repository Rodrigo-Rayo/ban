/** Copy for bell notifications created client-side. Kept short: the server caps title/body length. */

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** "A Lola le gusta tu perfil", or "Alguien ha guardado tu perfil" when the name is unknown. */
export function favoriteNoticeTitle(senderName: string | null | undefined): string {
  const who = firstName(senderName);
  return who ? `A ${who} le gusta tu perfil` : 'Alguien ha guardado tu perfil';
}

export const LESSON_REQUEST_TITLE = 'Nueva solicitud de clase';

/** "Lola quiere una clase el martes, 7 de octubre de 2026. Tienes los detalles en tus mensajes." */
export function lessonRequestBody(senderName: string | null | undefined, longDate: string | null | undefined): string {
  const who = (senderName ?? '').trim() || 'Alguien';
  const when = (longDate ?? '').trim();
  const ask = when ? `${who} quiere una clase el ${when}` : `${who} quiere una clase contigo`;
  return `${ask}. Tienes los detalles en tus mensajes.`;
}
