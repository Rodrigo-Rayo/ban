import { CARD_H, CARD_W, loadFonts, wrapText } from '../../core/utils/share-card';

/** What the story poster shows: the question, the answer and who wrote it. */
export interface QuestionCard {
  question: string;
  answer: string;
  name: string;
  /** "Guitarra · Madrid". */
  detail: string;
}

const PAPER = '#f2ebdd';
const INK = '#141210';
const RED = '#c23a1f';
const YELLOW = '#e8b931';
const PAD = 90;
const SAFE_TOP = 270;
const FOOT_Y = CARD_H - 440;
const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

type Measure = (font: string, s: string) => number;

/** Largest size (from `max` down to `min`) whose wrapped lines fit the box; the last line gets "…" if it never fits. */
export function fitText(measure: Measure, font: (size: number) => string, text: string, width: number, height: number,
                        max: number, min: number, lineHeight: number): { size: number; lines: string[] } {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrapText(s => measure(font(size), s), text, width);
    if (lines.length * size * lineHeight <= height) return { size, lines };
  }
  const lines = wrapText(s => measure(font(min), s), text, width);
  const fit = Math.max(1, Math.floor(height / (min * lineHeight)));
  return { size: min, lines: lines.length <= fit ? lines : [...lines.slice(0, fit - 1), lines[fit - 1] + '…'] };
}

/** The answer as a 1080×1920 poster for Instagram stories. */
export async function renderQuestionCard(card: QuestionCard): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  const measure: Measure = (font, s) => { ctx.font = font; return ctx.measureText(s).width; };
  const inner = CARD_W - PAD * 2;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, CARD_W, 28);

  // Head: the section, then the question itself.
  let y = SAFE_TOP + 20;
  ctx.fillStyle = RED;
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText('BANDYOU · LA PREGUNTA DEL MES', PAD, y, inner);
  const q = fitText(measure, s => `400 ${s}px ${DISPLAY}`, card.question.toUpperCase(), inner, 330, 104, 60, 1.08);
  ctx.fillStyle = INK;
  ctx.font = `400 ${q.size}px ${DISPLAY}`;
  y += 30;
  for (const line of q.lines) {
    y += q.size * 1.08;
    ctx.fillText(line, PAD, y, inner);
  }

  // The answer on a yellow card with a hard shadow, a little crooked like a pasted note.
  const boxY = y + 70;
  const boxH = FOOT_Y - 90 - boxY;
  ctx.save();
  ctx.translate(PAD, boxY);
  ctx.rotate(-0.012);
  ctx.fillStyle = INK;
  ctx.fillRect(14, 14, inner, boxH);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, inner, boxH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, inner, boxH);

  ctx.fillStyle = RED;
  ctx.font = `400 200px ${DISPLAY}`;
  ctx.fillText('“', 40, 180);

  const textW = inner - 100;
  const signH = 140;
  const a = fitText(measure, s => `600 ${s}px ${SANS}`, card.answer, textW, boxH - 200 - signH, 64, 36, 1.3);
  ctx.fillStyle = INK;
  ctx.font = `600 ${a.size}px ${SANS}`;
  let ty = 150;
  for (const line of a.lines) {
    ty += a.size * 1.3;
    ctx.fillText(line, 50, ty, textW);
  }

  // Signature at the bottom of the card.
  ctx.fillRect(50, boxH - signH, 120, 6);
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText(card.name, 50, boxH - signH + 66, textW);
  if (card.detail) {
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(card.detail.toUpperCase(), 50, boxH - signH + 112, textW);
  }
  ctx.restore();

  // Footer, above the part of the story Instagram covers.
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, FOOT_Y, inner, 8);
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText('¿Y tú? Responde en', PAD, FOOT_Y + 90);
  ctx.fillStyle = RED;
  ctx.font = `400 92px ${DISPLAY}`;
  ctx.fillText('BANDYOU.ES/PREGUNTA', PAD, FOOT_Y + 190, inner);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
