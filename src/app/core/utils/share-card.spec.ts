import { CARD_H, CARD_W, StoryImage, renderShareCard, slugFile, wrapText } from './share-card';

describe('share card', () => {
  const byChars = (s: string) => s.length;

  it('wraps words greedily within the width', () => {
    expect(wrapText(byChars, 'banda de rock busca batería', 12)).toEqual(['banda de', 'rock busca', 'batería']);
    expect(wrapText(byChars, 'supercalifragilistico corto', 10)).toEqual(['supercalifragilistico', 'corto']);
    expect(wrapText(byChars, '   ', 10)).toEqual([]);
  });

  it('builds a safe file name', () => {
    expect(slugFile('Busca batería · Madrid')).toBe('bandyou-busca-bateria-madrid.png');
    expect(slugFile('!!!')).toBe('bandyou-imagen.png');
  });

  it('renders a 1080×1920 PNG', async () => {
    const blob = await renderShareCard({
      kicker: 'Se busca · Madrid', stamp: 'Busca batería', title: 'Banda de rock busca batería',
      lines: ['Los Lunes Grises'],
    });
    expect(blob.type).toBe('image/png');
    const img = await createImageBitmap(blob);
    expect([img.width, img.height]).toEqual([CARD_W, CARD_H]);
  });

  it('keeps a very long title on the card', async () => {
    const blob = await renderShareCard({
      kicker: 'Se busca · Madrid', stamp: 'Busca colaboración',
      title: 'Productor de música electrónica busca voces, guitarras y teclados para un EP de seis canciones que grabamos este invierno',
      lines: ['Alguien', 'Otra línea', 'Tercera'], date: { weekday: 'lun', day: '1', month: 'dic' },
    });
    expect(blob.type).toBe('image/png');
  });

  it('StoryImage renders once and reuses the image on the next tap', async () => {
    const card = jasmine.createSpy('card').and.returnValue({ kicker: 'K', title: 'Título', lines: [] });
    const story = new StoryImage(card);
    const first = await story.blob();
    const second = await story.blob();
    expect(second).toBe(first);
    expect(card).toHaveBeenCalledTimes(1);
  });

  it('StoryImage fails cleanly while there is nothing to draw, and retries later', async () => {
    let ready = false;
    const story = new StoryImage(() => (ready ? { kicker: 'K', title: 'T', lines: [] } : null));
    await expectAsync(story.blob()).toBeRejected();
    ready = true;
    expect((await story.blob()).type).toBe('image/png');
  });

  it('renders an event card with a date block', async () => {
    const blob = await renderShareCard({
      kicker: 'Concierto · Madrid', title: 'Los Lunes Grises en directo',
      lines: ['Sala El Sótano', '21:30'], date: { weekday: 'sáb', day: '14', month: 'nov' },
    });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
