/**
 * Font size of the name stamped on a profile poster: long names get smaller type so
 * they never cover the photo. Measured by length and by the longest word (a long
 * word cannot wrap and would otherwise be hyphenated into many lines).
 * Full class strings so Tailwind picks them up.
 */
const SIZES = [
  'text-[clamp(2.25rem,11vw,4.75rem)] sm:text-7xl lg:text-5xl',
  'text-[clamp(1.875rem,8.5vw,3.75rem)] sm:text-6xl lg:text-4xl',
  'text-[clamp(1.625rem,7vw,3rem)] sm:text-5xl lg:text-4xl',
  'text-[clamp(1.5rem,6.25vw,2.5rem)] sm:text-4xl lg:text-3xl',
] as const;

export function posterNameSize(name: string | null | undefined): string {
  const text = (name ?? '').trim();
  const longestWord = Math.max(0, ...text.split(/\s+/).map(w => w.length));
  let tier = text.length <= 12 ? 0 : text.length <= 20 ? 1 : text.length <= 32 ? 2 : 3;
  if (longestWord > 9 && tier < 2) tier++;
  return SIZES[tier];
}
