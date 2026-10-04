/** A piece of user text: plain text, or a web link to render as <a>. */
export interface TextPart { text: string; href: string | null }

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
/** Punctuation that usually ends a sentence, not the URL ("…mira https://x.es."). */
const TRAILING = /[.,;:!?)\]}»”'"]+$/;

/**
 * Splits user text into plain and link parts so templates can render links
 * without innerHTML. Only http(s) URLs become links; everything else stays text.
 */
export function linkify(text: string | null | undefined): TextPart[] {
  const source = text ?? '';
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of source.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING, '');
    if (start > last) parts.push({ text: source.slice(last, start), href: null });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), href: null });
  return parts;
}

/** Shorter label for a long link: decoded, without protocol, cut at 60 characters. */
export function linkLabel(url: string): string {
  let label = url.replace(/^https?:\/\/(www\.)?/i, '');
  try { label = decodeURI(label); } catch { /* keep it encoded */ }
  return label.length > 60 ? label.slice(0, 57) + '…' : label;
}
