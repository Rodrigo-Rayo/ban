import { QUESTIONS, TYPES, TYPE_IDS, TypeId } from './test-data';
import { addAnswer, compat, emptyScores, isTypeId, winner } from './test-logic';

describe('test de banda', () => {
  it('every answer scores real types and every type can win', () => {
    const reachable = new Set<TypeId>();
    for (const q of QUESTIONS) {
      expect(q.a.length).toBe(4);
      for (const [, tags] of q.a) {
        expect(tags.length).toBeGreaterThan(0);
        tags.forEach(t => { expect(TYPES[t]).toBeDefined(); reachable.add(t); });
      }
    }
    expect([...reachable].sort()).toEqual([...TYPE_IDS].sort());
  });

  it('gives 2 points to a single type and 1 to each of two', () => {
    const one = addAnswer(emptyScores(), ['x', ['lab'], 'r']);
    expect(one.lab).toBe(2);
    const two = addAnswer(one, ['x', ['met', 'pue'], 'r']);
    expect(two.met).toBe(1);
    expect(two.pue).toBe(1);
    expect(one.met).toBe(0);
  });

  it('breaks a tie with the last answer, then with list order', () => {
    const s = { ...emptyScores(), chi: 3, fab: 3 };
    expect(winner(s, 'fab')).toBe('fab');
    expect(winner(s, 'lab')).toBe('chi');
    expect(winner(emptyScores(), null)).toBe('met');
  });

  it('answering the first option every time ends in a real type', () => {
    let s = emptyScores();
    let last: TypeId | null = null;
    for (const q of QUESTIONS) { s = addAnswer(s, q.a[0]); last = q.a[0][1][0]; }
    expect(isTypeId(winner(s, last))).toBeTrue();
  });

  it('reads only known types from a link', () => {
    expect(isTypeId('met')).toBeTrue();
    expect(isTypeId('xyz')).toBeFalse();
    expect(isTypeId(null)).toBeFalse();
  });

  it('compatibility is the same whoever plays first', () => {
    for (const a of TYPE_IDS) for (const b of TYPE_IDS) {
      expect(compat(a, b)).toEqual(compat(b, a));
      const { percent } = compat(a, b);
      expect(percent).toBeGreaterThanOrEqual(40);
      expect(percent).toBeLessThanOrEqual(94);
    }
    expect(compat('met', 'chi').percent).toBe(94);
    expect(compat('met', 'com').percent).toBe(41);
  });
});
