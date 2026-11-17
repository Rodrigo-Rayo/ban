import { fitText } from './question-card';

describe('fitText', () => {
  // Every character is as wide as the font size, so the maths stays obvious.
  const measure = (font: string, s: string) => s.length * parseInt(font, 10);
  const font = (size: number) => `${size}px`;

  it('takes the largest size that fits the box', () => {
    expect(fitText(measure, font, 'hola que tal', 400, 200, 60, 20, 1)).toEqual({ size: 60, lines: ['hola', 'que', 'tal'] });
    // Three lines no longer fit in 100px: it shrinks until two do.
    expect(fitText(measure, font, 'hola que tal', 400, 100, 60, 20, 1)).toEqual({ size: 48, lines: ['hola que', 'tal'] });
  });

  it('cuts with an ellipsis when even the smallest size does not fit', () => {
    const r = fitText(measure, font, 'uno dos tres cuatro cinco seis', 80, 40, 40, 20, 1);
    expect(r.size).toBe(20);
    expect(r.lines.length).toBe(2);
    expect(r.lines[1].endsWith('…')).toBeTrue();
  });
});
