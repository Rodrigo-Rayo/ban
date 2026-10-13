import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CommentsComponent } from './comments.component';
import { AuthService } from '../../../core/services/auth.service';
import { AppComment, CommentsService } from '../../../core/services/comments.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';

const comment = (id: string, user_id: string, text: string): AppComment => ({
  id, user_id, text, created_at: new Date().toISOString(),
  author_name: user_id === 'owner' ? 'Los Tal' : 'Ana', author_avatar: null, author_profile_type: 'musician', author_profile_id: 'm1',
});

describe('CommentsComponent', () => {
  let fixture: ComponentFixture<CommentsComponent>;
  const loggedIn = signal(true);
  const user = signal<{ id: string } | null>({ id: 'me' });
  let svc: jasmine.SpyObj<CommentsService>;
  let toastError: jasmine.Spy;

  async function render(total: number | null, list: AppComment[] = []) {
    svc.count.and.resolveTo(total);
    svc.list.and.resolveTo(list);
    fixture = TestBed.createComponent(CommentsComponent);
    fixture.componentRef.setInput('targetType', 'post');
    fixture.componentRef.setInput('targetId', 'p1');
    fixture.componentRef.setInput('ownerId', 'owner');
    // count first, then (signed in, not empty) the thread
    for (let i = 0; i < 2; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    loggedIn.set(true);
    user.set({ id: 'me' });
    svc = jasmine.createSpyObj<CommentsService>('CommentsService', ['count', 'list', 'add', 'remove']);
    toastError = jasmine.createSpy('error');
    await TestBed.configureTestingModule({
      imports: [CommentsComponent],
      providers: [
        provideRouter([]),
        { provide: CommentsService, useValue: svc },
        { provide: AuthService, useValue: { isLoggedIn: loggedIn, user } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
        { provide: ToastService, useValue: { error: toastError, success: () => {} } },
      ],
    }).compileComponents();
  });

  it('renders nothing while comments are not available', async () => {
    const el = await render(null);
    expect(el.querySelector('section')).toBeNull();
  });

  it('shows the thread and tags the owner', async () => {
    const el = await render(2, [comment('c1', 'u2', '¿Sigue en pie?'), comment('c2', 'owner', 'Sí')]);
    expect(el.textContent).toContain('Comentarios');
    expect(el.textContent).toContain('(2)');
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.textContent).toContain('Anunciante');
    expect(svc.list).toHaveBeenCalledWith({ type: 'post', id: 'p1' });
  });

  it('does not query the list when there are no comments', async () => {
    const el = await render(0);
    expect(svc.list).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Nadie ha comentado todavía');
  });

  it('visitors see only the count and a sign-in link', async () => {
    loggedIn.set(false);
    user.set(null);
    const el = await render(3);
    expect(svc.list).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Hay 3 comentarios.');
    expect(el.querySelector('a[href="/auth/login"]')).not.toBeNull();
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('lets authors and the owner delete, nobody else', async () => {
    await render(2, [comment('c1', 'me', 'mío'), comment('c2', 'u3', 'de otro')]);
    const cmp = fixture.componentInstance;
    expect(cmp.canDelete(comment('x', 'me', ''))).toBeTrue();
    expect(cmp.canDelete(comment('x', 'u3', ''))).toBeFalse();
    user.set({ id: 'owner' });
    expect(cmp.canDelete(comment('x', 'u3', ''))).toBeTrue();
  });

  it('publishes, clears the box and reloads the thread', async () => {
    await render(0);
    const cmp = fixture.componentInstance;
    svc.add.and.resolveTo(null);
    svc.count.and.resolveTo(1);
    svc.list.and.resolveTo([comment('c1', 'me', 'hola')]);
    cmp.draft = 'hola';
    await cmp.send();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(svc.add).toHaveBeenCalledWith({ type: 'post', id: 'p1' }, 'hola');
    expect(cmp.draft).toBe('');
    expect(cmp.total()).toBe(1);
    expect(cmp.comments().length).toBe(1);
    expect(svc.list).toHaveBeenCalledTimes(1);
  });

  it('reloads the thread after publishing when it already had comments', async () => {
    await render(1, [comment('c1', 'u2', 'hola')]);
    const cmp = fixture.componentInstance;
    svc.add.and.resolveTo(null);
    svc.count.and.resolveTo(2);
    svc.list.and.resolveTo([comment('c1', 'u2', 'hola'), comment('c2', 'me', 'qué tal')]);
    cmp.draft = 'qué tal';
    await cmp.send();
    expect(cmp.total()).toBe(2);
    expect(cmp.comments().length).toBe(2);
  });

  it('keeps the thread and offers a retry when the list cannot be read', async () => {
    const el = await render(2, []);
    svc.list.and.resolveTo(null);
    await fixture.componentInstance.retry();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('No se pudieron cargar los comentarios.');
    expect(el.textContent).not.toContain('Nadie ha comentado');
  });

  it('starts clean when the page moves to another post', async () => {
    await render(1, [comment('c1', 'u2', 'del anuncio A')]);
    const cmp = fixture.componentInstance;
    cmp.draft = 'a medio escribir';
    svc.count.and.resolveTo(0);
    fixture.componentRef.setInput('targetId', 'p2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.draft).toBe('');
    expect(cmp.comments()).toEqual([]);
    expect(cmp.total()).toBe(0);
    expect(svc.count).toHaveBeenCalledWith({ type: 'post', id: 'p2' });
  });

  it('tells visitors to sign in to comment when there are none', async () => {
    loggedIn.set(false);
    user.set(null);
    const el = await render(0);
    expect(el.textContent).toContain('Todavía no hay comentarios.');
    expect(el.textContent).toContain('para comentar.');
    expect(el.textContent).not.toContain('leerlos');
  });

  it('keeps the text and shows the error when publishing fails', async () => {
    await render(0);
    const cmp = fixture.componentInstance;
    svc.add.and.resolveTo('Has publicado demasiado en poco tiempo.');
    cmp.draft = 'hola';
    await cmp.send();
    expect(toastError).toHaveBeenCalledWith('Has publicado demasiado en poco tiempo.');
    expect(cmp.draft).toBe('hola');
    expect(cmp.sending()).toBeFalse();
  });

  it('removes a deleted comment and lowers the count', async () => {
    await render(1, [comment('c1', 'me', 'mío')]);
    const cmp = fixture.componentInstance;
    svc.remove.and.resolveTo(true);
    await cmp.remove(cmp.comments()[0]);
    expect(cmp.comments().length).toBe(0);
    expect(cmp.total()).toBe(0);
  });
});
