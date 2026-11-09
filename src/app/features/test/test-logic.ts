import { Answer, TYPES, TYPE_IDS, TypeId } from './test-data';

export type Scores = Readonly<Record<TypeId, number>>;

export const emptyScores = (): Scores => Object.fromEntries(TYPE_IDS.map(id => [id, 0])) as Record<TypeId, number>;

/** An answer for one type is worth 2; one shared by two types gives each 1. */
export function addAnswer(scores: Scores, answer: Answer): Scores {
  const tags = answer[1];
  const points = tags.length === 1 ? 2 : 1;
  const next = { ...scores };
  for (const t of tags) next[t] += points;
  return next;
}

/** Highest score; a tie goes to the type of the last answer that scored, then to list order. */
export function winner(scores: Scores, last: TypeId | null): TypeId {
  const top = Math.max(...TYPE_IDS.map(id => scores[id]));
  const tied = TYPE_IDS.filter(id => scores[id] === top);
  return last && tied.includes(last) ? last : tied[0];
}

export function isTypeId(value: unknown): value is TypeId {
  return typeof value === 'string' && (TYPE_IDS as string[]).includes(value);
}

/** How two types get on in a band: a fixed number per pair, so both players see the same. */
export function compat(a: TypeId, b: TypeId): { percent: number; verdict: string } {
  if (a === b) return { percent: 77, verdict: 'Sois iguales. O la mejor banda del barrio, o la peor.' };
  if (TYPES[a].fits === b || TYPES[b].fits === a) return { percent: 94, verdict: 'Encajáis. Esto huele a banda.' };
  if (TYPES[a].clash === b || TYPES[b].clash === a) return { percent: 41, verdict: 'Vais a chocar. De ahí salen los mejores discos.' };
  const [x, y] = [a, b].sort();
  const percent = 58 + ((x.charCodeAt(0) * 7 + y.charCodeAt(1) * 3) % 25);
  return { percent, verdict: 'Con un par de ensayos, os entendéis.' };
}
