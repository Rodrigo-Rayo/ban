/** Longest side, in pixels, per kind of upload. */
export const IMAGE_MAX_SIDE = { avatar: 800, photo: 1600 } as const;

/** Phone photos can be large: they are accepted up to this size and shrunk before upload. */
export const RAW_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

const RESIZABLE = /^image\/(jpeg|png|webp)$/;

/**
 * Shrinks an image in the browser before uploading it: longest side ≤ `maxSide`,
 * re-encoded as WebP (JPEG where the browser cannot encode WebP). Supabase image
 * transformations are not enabled, so whatever is uploaded is what visitors download.
 * Returns the original file when it is already small enough or anything fails.
 */
export async function shrinkImage(file: File, maxSide: number, quality = 0.82): Promise<File> {
  if (!RESIZABLE.test(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let blob = await toBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) return file;
    // Never make a file bigger just to change its format.
    if (scale === 1 && blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
