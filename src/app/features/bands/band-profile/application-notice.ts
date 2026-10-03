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
