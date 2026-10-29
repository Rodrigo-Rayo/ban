import { isFree } from '../../search/agenda/agenda';

/**
 * schema.org `offers` for an event, so Google can show it as an event result:
 * only when there is a readable price ("Gratis", "10", "10 €", "12,50"), which Google requires.
 */
export function eventOffer(e: { id: string; price?: string | null; ticket_url?: string | null }): { offers?: Record<string, unknown> } {
  const amount = isFree(e.price) ? '0' : e.price?.trim().match(/^(\d+(?:[.,]\d{1,2})?)\s*€?$/)?.[1]?.replace(',', '.');
  if (amount === undefined) return {};
  return {
    offers: {
      '@type': 'Offer',
      url: e.ticket_url || `https://www.bandyou.es/events/${e.id}`,
      price: amount,
      priceCurrency: 'EUR',
    },
  };
}
