import { CARD_H, CARD_W, loadFonts, wrapText } from '../../core/utils/share-card';
import { MusicianType } from './test-data';

/** What the story poster shows: the result, the instrument and both images. */
export interface TestCard {
  type: MusicianType;
  instrument: string;
  typeImage: string;
  fitsName: string;
  clashName: string;
}

const PAPER = '#f2ebdd';
const CARD = '#faf6ee';
const INK = '#141210';
const RED = '#c23a1f';
const YELLOW = '#e8b931';
const PAD = 90;
const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Largest Anton size that fits the name in `maxLines` within the box. */
function fitName(ctx: CanvasRenderingContext2D, text: string, width: number, maxHeight: number): { size: number; lines: string[] } {
  for (let size = 130; size >= 56; size -= 6) {
    ctx.font = `400 ${size}px ${DISPLAY}`;
    const lines = wrapText(s => ctx.measureText(s).width, text, width);
    if (lines.length <= 3 && lines.length * size * 1.05 <= maxHeight) return { size, lines };
  }
  ctx.font = `400 56px ${DISPLAY}`;
  return { size: 56, lines: wrapText(s => ctx.measureText(s).width, text, width).slice(0, 3) };
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, label: string, value: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText(label.toUpperCase(), x + 22, y + 44, w - 44);
  ctx.font = `600 36px ${SANS}`;
  wrapText(s => ctx.measureText(s).width, value, w - 44).slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, x + 22, y + 92 + i * 42, w - 44));
}

/** The result as a 1080×1920 "Se busca" poster for Instagram stories. */
export async function renderTestCard(card: TestCard): Promise<Blob> {
  const [, art] = await Promise.all([loadFonts(), loadImage(card.typeImage)]);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  const inner = CARD_W - PAD * 2;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Head: who made it, then the poster's own words.
  ctx.fillStyle = RED;
  ctx.font = `700 32px ${MONO}`;
  ctx.fillText('BANDYOU · TEST DE BANDA', PAD, 330);
  ctx.fillStyle = INK;
  ctx.font = `400 170px ${DISPLAY}`;
  ctx.fillText('SE BUSCA', PAD - 4, 500);
  ctx.fillRect(PAD, 530, inner, 8);

  // The stamp with the type's engraving, a little crooked like a real one.
  const S = 300, sy = 580;
  ctx.save();
  ctx.translate(PAD + S / 2, sy + S / 2);
  ctx.rotate(-0.05);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(-S / 2, -S / 2, S, S);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(-S / 2, -S / 2, S, S);
  if (art) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(art, -S * 0.4, -S * 0.4, S * 0.8, S * 0.8);
  }
  ctx.restore();

  const colX = PAD + S + 44, colW = CARD_W - PAD - colX;
  ctx.fillStyle = RED;
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText(card.instrument.toUpperCase(), colX, sy + 40, colW);
  const name = fitName(ctx, card.type.name.toUpperCase(), colW, S - 50);
  ctx.fillStyle = INK;
  ctx.font = `400 ${name.size}px ${DISPLAY}`;
  name.lines.forEach((line, i) => ctx.fillText(line, colX, sy + 60 + (i + 1) * name.size * 1.02, colW));

  let y = sy + S + 90;
  ctx.font = `700 50px ${SANS}`;
  for (const line of wrapText(s => ctx.measureText(s).width, card.type.tag, inner).slice(0, 3)) {
    ctx.fillText(line, PAD, y, inner);
    y += 62;
  }

  // Stats as bars.
  y += 24;
  for (const [label, value] of card.type.stats) {
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(label, PAD, y, inner - 120);
    ctx.font = `700 32px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${value}%`, CARD_W - PAD, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = CARD;
    ctx.fillRect(PAD, y + 16, inner, 26);
    ctx.fillStyle = INK;
    ctx.fillRect(PAD, y + 16, inner * value / 100, 26);
    ctx.lineWidth = 4;
    ctx.strokeRect(PAD, y + 16, inner, 26);
    y += 92;
  }

  const half = (inner - 24) / 2;
  box(ctx, PAD, y, half, 150, YELLOW, 'Encaja con', card.fitsName);
  box(ctx, PAD + half + 24, y, half, 150, CARD, 'Choca con', card.clashName);

  // Footer, above the part of the story Instagram covers.
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, 1590, inner, 8);
  ctx.font = `600 40px ${SANS}`;
  ctx.fillText('¿Y tú qué músico eres?', PAD, 1655);
  ctx.fillStyle = RED;
  ctx.font = `400 64px ${DISPLAY}`;
  ctx.textAlign = 'right';
  ctx.fillText('BANDYOU.ES/TEST', CARD_W - PAD, 1660);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
