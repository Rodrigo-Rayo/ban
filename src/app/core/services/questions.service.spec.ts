import { TestBed } from '@angular/core/testing';
import { QuestionsService, daysLeft, deadlineLabel, isOpen, monthLabel } from './questions.service';
import { SupabaseService } from './supabase.service';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from './profile-gate.service';

/** A chainable stand-in for a PostgREST query that resolves to `result`. */
function query(result: unknown) {
  const q: Record<string, jasmine.Spy> & PromiseLike<unknown> = {
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko),
  } as never;
  for (const m of ['select', 'eq', 'lt', 'order', 'limit', 'insert', 'update', 'delete']) q[m] = jasmine.createSpy(m).and.returnValue(q);
  q['single'] = jasmine.createSpy('single').and.resolveTo(result);
  q['maybeSingle'] = jasmine.createSpy('maybeSingle').and.resolveTo(result);
  return q;
}

describe('question helpers', () => {
  const q = { opens_at: '2026-11-17T00:00:00Z', closes_at: '2026-12-15T00:00:00Z' };

  it('is open between opening and closing only', () => {
    expect(isOpen(q, Date.parse('2026-11-16T23:59:00Z'))).toBeFalse();
    expect(isOpen(q, Date.parse('2026-11-20T10:00:00Z'))).toBeTrue();
    expect(isOpen(q, Date.parse('2026-12-15T00:00:00Z'))).toBeFalse();
  });

  it('counts whole days left and says the last one', () => {
    expect(daysLeft(q, Date.parse('2026-12-01T00:00:00Z'))).toBe(14);
    expect(deadlineLabel(q, Date.parse('2026-12-01T00:00:00Z'))).toBe('Quedan 14 días');
    expect(deadlineLabel(q, Date.parse('2026-12-13T12:00:00Z'))).toBe('Queda 1 día');
    expect(deadlineLabel(q, Date.parse('2026-12-14T20:00:00Z'))).toBe('Último día');
    expect(daysLeft(q, Date.parse('2027-01-01T00:00:00Z'))).toBe(0);
  });

  it('names the month in Spanish', () => {
    expect(monthLabel('2026-11-17T12:00:00Z')).toBe('noviembre 2026');
  });
});

describe('QuestionsService', () => {
  let from: jasmine.Spy;
  let result: unknown;
  let last: ReturnType<typeof query>;
  let gateOk: boolean;
  let svc: QuestionsService;

  beforeEach(() => {
    gateOk = true;
    result = { data: [], error: null };
    from = jasmine.createSpy('from').and.callFake(() => (last = query(result)));
    TestBed.configureTestingModule({
      providers: [
        QuestionsService,
        { provide: SupabaseService, useValue: { client: { from } } },
        { provide: ProfileGateService, useValue: { ensure: () => Promise.resolve(gateOk) } },
      ],
    });
    svc = TestBed.inject(QuestionsService);
  });

  it('reads opened questions newest first, with starters always a list', async () => {
    result = { data: [{ id: 'q1', starters: null }], error: null };
    expect(await svc.questions()).toEqual([jasmine.objectContaining({ id: 'q1', starters: [] })]);
    expect(from).toHaveBeenCalledWith('questions');
    expect(last['order']).toHaveBeenCalledWith('opens_at', { ascending: false });
  });

  it('answers null and stops asking when the SQL has not been run', async () => {
    result = { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    expect(await svc.questions()).toBeNull();
    expect(await svc.questions()).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('keeps the questions for a few minutes, but asks again after a failed read', async () => {
    await svc.questions();
    await svc.questions();
    expect(from).toHaveBeenCalledTimes(1);
    const fresh = TestBed.inject(QuestionsService);
    expect(fresh).toBe(svc);
    result = { data: null, error: { code: '', message: 'Failed to fetch' } };
    (svc as unknown as { cache: null }).cache = null;
    expect(await svc.questions()).toBeNull();
    await Promise.resolve();
    result = { data: [], error: null };
    expect(await svc.questions()).toEqual([]);
  });

  it('brings the total with the first page, and pages with a created_at cursor', async () => {
    result = { data: [{ id: 'a1' }], error: null, count: 7 };
    expect(await svc.answers('q1')).toEqual({ rows: [jasmine.objectContaining({ id: 'a1' })], total: 7 });
    expect(last['select']).toHaveBeenCalledWith(jasmine.any(String), { count: 'exact' });
    await svc.answers('q1', '2026-11-20T10:00:00Z');
    expect(last['eq']).toHaveBeenCalledWith('question_id', 'q1');
    expect(last['lt']).toHaveBeenCalledWith('created_at', '2026-11-20T10:00:00Z');
  });

  it('inserts a new answer trimmed, and updates an existing one by id', async () => {
    result = { data: { id: 'a1', text: 'hola' }, error: null };
    expect(await svc.save('q1', '  hola  ')).toEqual(jasmine.objectContaining({ id: 'a1' }));
    expect(last['insert']).toHaveBeenCalledWith({ question_id: 'q1', text: 'hola' });
    await svc.save('q1', 'otra', 'a1');
    expect(last['update']).toHaveBeenCalledWith({ text: 'otra' });
    expect(last['eq']).toHaveBeenCalledWith('id', 'a1');
  });

  it('refuses empty and too long text, and asks for a profile first', async () => {
    expect(await svc.save('q1', '   ')).toEqual(jasmine.any(String));
    expect(await svc.save('q1', 'x'.repeat(281))).toContain('280');
    gateOk = false;
    expect(await svc.save('q1', 'hola')).toBe(PROFILE_REQUIRED_MESSAGE);
    expect(from).not.toHaveBeenCalled();
  });

  it('explains a closed question and a duplicate answer', async () => {
    result = { data: null, error: { hint: 'closed', code: 'P0001' } };
    expect(await svc.save('q1', 'hola')).toBe('Esta pregunta ya está cerrada.');
    result = { data: null, error: { hint: null, code: '23505' } };
    expect(await svc.save('q1', 'hola')).toContain('Ya habías respondido');
  });
});
