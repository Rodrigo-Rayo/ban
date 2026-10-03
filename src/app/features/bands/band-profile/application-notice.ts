/** "la batería", "el bajo"… for the notification text; null when no natural phrase exists. */
const ARTICLES: Readonly<Record<string, string>> = {
  guitarra: 'la', bajo: 'el', 'batería': 'la', teclados: 'los', 'violín': 'el', trompeta: 'la',
  'saxofón': 'el', piano: 'el', flauta: 'la', clarinete: 'el', contrabajo: 'el', arpa: 'la', 'percusión': 'la',
};

/**
 * Body of the notification the band owner gets when someone applies:
 * "Ana García quiere tocar la batería en tu banda". Falls back to neutral
 * wording when the musician's name or a natural instrument phrase is missing.
 */
export function applicationNoticeBody(musicianName: string | null | undefined, instrument: string | null | undefined): string {
  const who = (musicianName ?? '').trim() || 'Alguien';
  const inst = (instrument ?? '').trim().toLowerCase();
  if (inst === 'voz') return `${who} quiere cantar en tu banda`;
  const article = ARTICLES[inst];
  return article ? `${who} quiere tocar ${article} ${inst} en tu banda` : `${who} quiere unirse a tu banda`;
}

/** Body shown to applicants when a vacancy closes: kind, never a rejection. */
export const VACANCY_CLOSED_BODY = 'Gracias por tu interés. Hay más vacantes en Se busca.';

/** "La vacante de batería en Los Tests se ha cerrado" (neutral fallback without instrument). */
export function vacancyClosedTitle(bandName: string | null | undefined, instrument: string | null | undefined): string {
  const band = (bandName ?? '').trim() || 'la banda';
  const inst = (instrument ?? '').trim().toLowerCase();
  return inst ? `La vacante de ${inst} en ${band} se ha cerrado` : `Una vacante en ${band} se ha cerrado`;
}

/** "Han revisado tu solicitud en Los Tests": impersonal, so it reads well with any band name. */
export function applicationReviewedTitle(bandName: string | null | undefined): string {
  const band = (bandName ?? '').trim();
  return band ? `Han revisado tu solicitud en ${band}` : 'Han revisado tu solicitud';
}

/** "Vacante de batería", or undefined when the instrument is unknown. */
export function applicationReviewedBody(instrument: string | null | undefined): string | undefined {
  const inst = (instrument ?? '').trim().toLowerCase();
  return inst ? `Vacante de ${inst}` : undefined;
}
