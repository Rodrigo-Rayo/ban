/**
 * People and businesses BandYou has really collaborated with (a joint post, a
 * giveaway, an article…). Shown on /colaboradores with a link to their site.
 * A paid placement must set `sponsored: true` (Google asks for rel="sponsored").
 */
export interface Partner {
  name: string;
  /** What they are, in a few words: "Sala de conciertos en Lavapiés". */
  kind: string;
  /** What we did together. */
  together: string;
  url: string;
  instagram?: string;
  /** BandYou profile, when they have one: ['/venues', id]. */
  profile?: string[];
  sponsored?: boolean;
}

export const PARTNERS: readonly Partner[] = [
  {
    name: 'Promosapiens',
    kind: 'Agencia de promoción musical',
    together: 'Nos ayudaron a dar a conocer BandYou en prensa.',
    url: 'https://www.promosapiens.net',
  },
  {
    name: 'Inout Viajes',
    kind: 'Revista digital',
    together: 'Publicaron el nacimiento de BandYou (octubre de 2026).',
    url: 'https://www.inoutviajes.com',
  },
];

/** rel for a partner link: always opens safely; paid ones are marked as Google asks. */
export function partnerRel(p: Partner): string {
  return p.sponsored ? 'noopener sponsored' : 'noopener';
}
