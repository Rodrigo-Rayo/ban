import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { QuestionPageComponent, answerDetail, cardTone } from './question-page.component';
import { Answer, Question, QuestionsService } from '../../core/services/questions.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';

const DAY = 864e5;
function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q1', slug: 'peor-bolo', title: '¿Cuál ha sido el peor bolo de tu vida?', intro: 'Sin nombres.',
    starters: ['Llegamos a la sala y…'],
    opens_at: new Date(Date.now() - 3 * DAY).toISOString(), closes_at: new Date(Date.now() + 10 * DAY).toISOString(),
    ...over,
  };
}
function answer(over: Partial<Answer> = {}): Answer {
  return {
    id: 'a1', question_id: 'q1', user_id: 'u2', text: 'Se fue la luz.', created_at: '2026-11-17T10:00:00Z', updated_at: '2026-11-17T10:00:00Z',
    author_name: 'Ana', author_avatar: null, author_profile_type: 'musician', author_profile_id: 'm1', author_role: 'Batería', author_city: 'Madrid',
    ...over,
  };
}

describe('QuestionPageComponent', () => {
  let svc: jasmine.SpyObj<QuestionsService>;
  let session: ReturnType<typeof signal<{ user: { id: string } } | null>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    localStorage.removeItem('bandyou_answer_q1');
    svc = jasmine.createSpyObj<QuestionsService>('QuestionsService', ['questions', 'answers', 'mine', 'save', 'remove']);
    svc.questions.and.resolveTo([question()]);
    svc.answers.and.resolveTo({ rows: [answer()], total: 1 });
    svc.mine.and.resolveTo(null);
    session = signal(null);
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [QuestionPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: QuestionsService, useValue: svc },
        { provide: AuthService, useValue: { isLoggedIn: computed(() => !!session()), user: computed(() => session()?.user ?? null) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
      ],
    });
  });

  afterEach(() => localStorage.removeItem('bandyou_answer_q1'));

  async function render() {
    const fixture = TestBed.createComponent(QuestionPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the open question, its count and the answers wall', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toContain('peor bolo');
    expect(el.textContent).toContain('1 respuesta');
    expect(el.textContent).toContain('Quedan');
    expect(el.textContent).toContain('Se fue la luz.');
    expect(el.textContent).toContain('Batería · Madrid');
  });

  it('starts the answer with a starter phrase', async () => {
    const { cmp, el, fixture } = await render();
    el.querySelector<HTMLButtonElement>('#responder button[type="button"]')!.click();
    fixture.detectChanges();
    expect(cmp.draft()).toBe('Llegamos a la sala y ');
  });

  it('lets visitors write first: keeps the draft and sends them to sign in', async () => {
    const { cmp } = await render();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    cmp.onDraft('Tocamos para el camarero');
    await cmp.publish();
    expect(localStorage.getItem('bandyou_answer_q1')).toBe('Tocamos para el camarero');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(svc.save).not.toHaveBeenCalled();
  });

  it('publishes for a signed-in person and shows their answer with the share button', async () => {
    session.set({ user: { id: 'u1' } });
    svc.save.and.resolveTo(answer({ id: 'a9', user_id: 'u1', text: 'Mi peor bolo' }));
    const { cmp, el, fixture } = await render();
    cmp.onDraft('Mi peor bolo');
    await cmp.publish();
    fixture.detectChanges();
    expect(svc.save).toHaveBeenCalledWith('q1', 'Mi peor bolo', undefined);
    expect(el.querySelector('#mine-title')).toBeTruthy();
    expect(el.textContent).toContain('Compartir en historias');
    expect(el.textContent).toContain('2 respuestas');
    expect(localStorage.getItem('bandyou_answer_q1')).toBeNull();
  });

  it('brings back a draft written before signing in', async () => {
    localStorage.setItem('bandyou_answer_q1', 'Lo escribí antes');
    session.set({ user: { id: 'u1' } });
    const { cmp, el } = await render();
    expect(cmp.draft()).toBe('Lo escribí antes');
    expect(el.textContent).toContain('te estaba esperando');
  });

  it('shows a past question read-only, with a way to the open one', async () => {
    svc.questions.and.resolveTo([question(), question({ id: 'q0', slug: 'antigua', title: '¿Pregunta antigua?', opens_at: '2026-01-01T00:00:00Z', closes_at: '2026-02-01T00:00:00Z' })]);
    params.next(convertToParamMap({ slug: 'antigua' }));
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toContain('antigua');
    expect(el.querySelector('#responder')).toBeNull();
    expect(el.textContent).toContain('ya está cerrada');
    expect(el.textContent).toContain('Responder la de este mes');
  });

  it('says it is coming soon when there is no question', async () => {
    svc.questions.and.resolveTo(null);
    const { el } = await render();
    expect(el.textContent).toContain('Pronto, una pregunta nueva');
  });

  it('signs answers and gives the wall a poster rhythm', () => {
    expect(answerDetail({ author_role: 'Guitarra', author_city: 'Madrid' })).toBe('Guitarra · Madrid');
    expect(answerDetail({ author_role: null, author_city: ' ' })).toBe('');
    expect([0, 1, 2, 3].map(cardTone)).toEqual(['paper', 'yellow', 'paper', 'ink']);
  });
});
