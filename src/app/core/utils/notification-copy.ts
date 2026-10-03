/** Copy for bell notifications created client-side. Kept short: the server caps title/body length. */

/** Saving a profile is private: the owner hears that someone saved it, never who. */
export const FAVORITE_NOTICE_TITLE = 'Alguien ha guardado tu perfil';

export const LESSON_REQUEST_TITLE = 'Nueva solicitud de clase';

/** "Lola quiere una clase el martes, 7 de octubre de 2026. Tienes los detalles en tus mensajes." */
export function lessonRequestBody(senderName: string | null | undefined, longDate: string | null | undefined): string {
  const who = (senderName ?? '').trim() || 'Alguien';
  const when = (longDate ?? '').trim();
  const ask = when ? `${who} quiere una clase el ${when}` : `${who} quiere una clase contigo`;
  return `${ask}. Tienes los detalles en tus mensajes.`;
}
