import { eventOffer } from './event-offer';

describe('eventOffer', () => {
  it('reads plain and free prices', () => {
    expect(eventOffer({ id: '1', price: '10 €' }).offers).toEqual(jasmine.objectContaining({ price: '10', priceCurrency: 'EUR' }));
    expect(eventOffer({ id: '1', price: '12,50' }).offers).toEqual(jasmine.objectContaining({ price: '12.50' }));
    expect(eventOffer({ id: '1', price: 'Gratis' }).offers).toEqual(jasmine.objectContaining({ price: '0' }));
  });

  it('links to the tickets when there are any', () => {
    expect(eventOffer({ id: '1', price: '8', ticket_url: 'https://tickets.example/x' }).offers!['url']).toBe('https://tickets.example/x');
    expect(eventOffer({ id: '1', price: '8' }).offers!['url']).toBe('https://www.bandyou.es/events/1');
  });

  it('adds nothing when the price cannot be read, even with tickets', () => {
    expect(eventOffer({ id: '1', price: '10-15 € anticipada', ticket_url: 'https://tickets.example/x' })).toEqual({});
  });

  it('adds nothing without a price or tickets', () => {
    expect(eventOffer({ id: '1', price: null })).toEqual({});
    expect(eventOffer({ id: '1', price: 'a la gorra' })).toEqual({});
  });
});
