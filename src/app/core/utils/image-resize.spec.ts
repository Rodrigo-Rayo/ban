import { shrinkImage, IMAGE_MAX_SIDE } from './image-resize';

/** Real PNG of the given size, drawn on a canvas. */
async function png(width: number, height: number): Promise<File> {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `hsl(${i % 360} 70% 50%)`; ctx.fillRect(Math.random() * width, Math.random() * height, 40, 40); }
  const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'));
  return new File([blob], 'photo.png', { type: 'image/png' });
}

async function dimensions(file: File): Promise<[number, number]> {
  const bmp = await createImageBitmap(file);
  return [bmp.width, bmp.height];
}

describe('shrinkImage', () => {
  it('scales a large photo down to the max side and re-encodes it smaller', async () => {
    const big = await png(3000, 2000);
    const out = await shrinkImage(big, IMAGE_MAX_SIDE.photo);
    expect(await dimensions(out)).toEqual([1600, 1067]);
    expect(out.type).toMatch(/image\/(webp|jpeg)/);
    expect(out.size).toBeLessThan(big.size);
  });

  it('leaves non-images and unreadable files untouched', async () => {
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    expect(await shrinkImage(pdf, 800)).toBe(pdf);
    const broken = new File([new Uint8Array(10)], 'x.png', { type: 'image/png' });
    expect(await shrinkImage(broken, 800)).toBe(broken);
  });
});
