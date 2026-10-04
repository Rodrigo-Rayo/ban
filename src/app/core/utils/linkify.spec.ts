import { linkify, linkLabel } from './linkify';

describe('linkify', () => {
  it('turns http(s) URLs into link parts and keeps the rest as text', () => {
    expect(linkify('Mi canal: https://youtube.com/@ana. ¡Escuchadlo!')).toEqual([
      { text: 'Mi canal: ', href: null },
      { text: 'https://youtube.com/@ana', href: 'https://youtube.com/@ana' },
      { text: '. ¡Escuchadlo!', href: null },
    ]);
  });

  it('never links other schemes', () => {
    expect(linkify('javascript:alert(1) y www.x.es').every(p => p.href === null)).toBeTrue();
  });

  it('handles empty text', () => {
    expect(linkify(null)).toEqual([]);
  });
});

describe('linkLabel', () => {
  it('drops the protocol and decodes accents', () => {
    expect(linkLabel('https://www.youtube.com/@%C3%81lvaro')).toBe('youtube.com/@Álvaro');
  });

  it('shortens long links', () => {
    expect(linkLabel('https://x.es/' + 'a'.repeat(100)).length).toBe(58);
  });
});
