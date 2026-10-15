import { avatarSrc, imageSrc } from './display.utils';

describe('imageSrc', () => {
  const stored = 'https://yxaurffzwtqsckfmnzdj.supabase.co/storage/v1/object/public/avatars/u1/a b.jpg';

  it('asks Vercel for the smallest configured width that covers the request', () => {
    expect(imageSrc(stored, 128, 'www.bandyou.es'))
      .toBe('/_vercel/image?url=' + encodeURIComponent(stored) + '&w=192&q=75');
    expect(imageSrc(stored, 96, 'banyou-git-x.vercel.app')).toContain('&w=96&');
    expect(imageSrc(stored, 5000, 'bandyou.es')).toContain('&w=1200&');
  });

  it('keeps the original off the deployed site and for other hosts', () => {
    expect(imageSrc(stored, 96, 'localhost')).toBe(stored);
    expect(imageSrc('https://picsum.photos/1.jpg', 96, 'www.bandyou.es')).toBe('https://picsum.photos/1.jpg');
    expect(imageSrc('blob:https://www.bandyou.es/x', 96, 'www.bandyou.es')).toBe('blob:https://www.bandyou.es/x');
    expect(imageSrc(stored, 96, 'evilbandyou.es')).toBe(stored);
  });

  it('returns null without a URL', () => {
    expect(imageSrc(null, 96)).toBeNull();
    expect(avatarSrc(undefined)).toBeNull();
  });
});
