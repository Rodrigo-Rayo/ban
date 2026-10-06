/**
 * Poster-style story image (1080×1920) for Instagram/WhatsApp, drawn on a canvas in
 * the browser with the site's own self-hosted fonts. Nothing leaves the device until
 * the user shares or saves it.
 */
export interface ShareCard {
  /** Small mono line on top, e.g. "Se busca · Madrid". */
  kicker: string;
  /** Yellow stamp, e.g. "Busca batería" (optional). */
  stamp?: string;
  /** Big Anton headline. */
  title: string;
  /** Up to three short lines under the title (author, venue, date…). */
  lines: string[];
  /** Red date block for events. */
  date?: { weekday: string; day: string; month: string };
}

export const CARD_W = 1080;
export const CARD_H = 1920;
const PAPER = '#f2ebdd';
const INK = '#141210';
const RED = '#c23a1f';
const YELLOW = '#e8b931';
const PAD = 90;
/** Instagram covers roughly the top and bottom 250px of a story with its own UI. */
const SAFE_TOP = 270;
const FOOT_Y = CARD_H - 440;
const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Greedy word wrap; a single word longer than the width gets its own line. */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  // Sample text so accented faces (unicode-range subsets) load too.
  const sample = 'AZaz09 ÁÉÍÓÚÑáéíóúñ¿¡·';
  await Promise.all([
    document.fonts.load(`400 100px Anton`, sample),
    document.fonts.load(`600 40px "Instrument Sans"`, sample),
    document.fonts.load(`700 30px "JetBrains Mono"`, sample),
  ]).catch(() => undefined);
}

const LINE = 1.16;

/** Largest headline size (200 → 72) whose wrapped lines fit both `maxLines` and `maxHeight`. */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number, maxHeight: number): { size: number; lines: string[] } {
  for (let size = 200; size >= 72; size -= 8) {
    ctx.font = `400 ${size}px ${DISPLAY}`;
    const lines = wrapText(s => ctx.measureText(s).width, text, width);
    if (lines.length <= maxLines && lines.length * size * LINE <= maxHeight) return { size, lines };
  }
  const size = 72;
  ctx.font = `400 ${size}px ${DISPLAY}`;
  const all = wrapText(s => ctx.measureText(s).width, text, width);
  const fit = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (size * LINE))));
  const lines = all.length <= fit ? all : [...all.slice(0, fit - 1), all[fit - 1] + '…'];
  return { size, lines };
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, CARD_W, 28);
  // Faint diagonal print lines, like the posters on the site.
  ctx.strokeStyle = 'rgba(20,18,16,0.035)';
  ctx.lineWidth = 22;
  for (let x = -CARD_H; x < CARD_W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, CARD_H);
    ctx.lineTo(x + CARD_H * 0.6, 0);
    ctx.stroke();
  }
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.font = `400 ${size}px ${DISPLAY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.fillText('BAND', x, y);
  ctx.fillStyle = RED;
  ctx.fillText('YOU', x + ctx.measureText('BAND').width, y);
}

function drawStamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  ctx.save();
  ctx.font = `400 64px ${DISPLAY}`;
  const label = text.toUpperCase();
  const w = Math.min(ctx.measureText(label).width + 64, CARD_W - PAD * 2);
  const h = 104;
  ctx.translate(x, y);
  ctx.rotate(-0.025);
  ctx.fillStyle = INK;
  ctx.fillRect(10, 10, w, h);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 32, h / 2 + 4, w - 64);
  ctx.restore();
  return h + 30;
}

function drawDate(ctx: CanvasRenderingContext2D, date: NonNullable<ShareCard['date']>, x: number, y: number): number {
  const w = 250;
  const h = 300;
  ctx.fillStyle = INK;
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = RED;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 36px ${MONO}`;
  ctx.fillText(date.weekday.toUpperCase(), x + w / 2, y + 62);
  ctx.font = `400 150px ${DISPLAY}`;
  ctx.fillText(date.day, x + w / 2, y + 220);
  ctx.font = `700 36px ${MONO}`;
  ctx.fillText(date.month.toUpperCase(), x + w / 2, y + 272);
  ctx.textAlign = 'left';
  return h + 70;
}

/** Draws the card and returns it as a PNG. */
export async function renderShareCard(card: ShareCard): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');

  drawBackground(ctx);
  drawWordmark(ctx, PAD, SAFE_TOP + 40, 96);

  let y = SAFE_TOP + 170;
  ctx.fillStyle = RED;
  ctx.font = `700 38px ${MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(card.kicker.toUpperCase(), PAD, y, CARD_W - PAD * 2);
  y += 60;

  if (card.date) y += drawDate(ctx, card.date, PAD, y);
  if (card.stamp) y += drawStamp(ctx, card.stamp, PAD, y);

  const subLines = card.lines.filter(Boolean).slice(0, 3);
  const subHeight = subLines.length ? 40 + subLines.length * 64 : 0;
  const { size, lines } = fitTitle(ctx, card.title.toUpperCase(), CARD_W - PAD * 2, card.date ? 4 : 5, FOOT_Y - 60 - y - subHeight);
  ctx.fillStyle = INK;
  ctx.font = `400 ${size}px ${DISPLAY}`;
  for (const line of lines) {
    y += size * LINE;
    ctx.fillText(line, PAD, y, CARD_W - PAD * 2);
  }

  y += 40;
  ctx.font = `600 46px ${SANS}`;
  for (const line of subLines) {
    y += 64;
    ctx.fillText(line, PAD, y, CARD_W - PAD * 2);
  }

  // Footer: rule, call to action and the address.
  const footY = FOOT_Y;
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, footY, CARD_W - PAD * 2, 8);
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText('Encuéntralo en', PAD, footY + 90);
  ctx.font = `400 92px ${DISPLAY}`;
  ctx.fillStyle = RED;
  ctx.fillText('BANDYOU.ES', PAD, footY + 190);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'blocked';

/**
 * Opens the phone's share sheet with the image (Instagram, WhatsApp…) where the
 * browser can share files; otherwise downloads it. 'cancelled' = the user closed the
 * sheet; 'blocked' = the browser refused (tap lost, e.g. Safari after a slow render):
 * a second tap, with the image already made, works.
 */
export async function shareImage(blob: Blob, filename: string, url: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: url });
      return 'shared';
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'blocked';
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return 'downloaded';
}

/**
 * Renders the card ahead of time (when the browser is idle) so a tap can open the share
 * sheet straight away: Safari only allows navigator.share right after the user's tap.
 */
export class StoryImage {
  private ready: Blob | null = null;
  private pending: Promise<Blob> | null = null;

  constructor(private readonly card: () => ShareCard | null) {}

  /** Start rendering when idle; safe to call more than once. */
  prepare(): void {
    if (this.pending || typeof window === 'undefined') return;
    const run = () => { this.render().catch(() => undefined); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(run); else setTimeout(run, 300);
  }

  /** The image, rendering it now if it is not ready yet. */
  async blob(): Promise<Blob> {
    return this.ready ?? this.render();
  }

  private render(): Promise<Blob> {
    if (this.pending) return this.pending;
    const card = this.card();
    if (!card) return Promise.reject(new Error('Nothing to draw yet'));
    const pending = renderShareCard(card).then(b => (this.ready = b));
    this.pending = pending;
    pending.catch(() => { if (this.pending === pending) this.pending = null; });
    return pending;
  }
}

/** "busca-bateria-madrid.png" from any text. */
export function slugFile(text: string): string {
  const slug = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `bandyou-${slug || 'imagen'}.png`;
}
