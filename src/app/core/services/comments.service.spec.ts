import { TestBed } from '@angular/core/testing';
import { CommentsService } from './comments.service';
import { SupabaseService } from './supabase.service';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from './profile-gate.service';

describe('CommentsService', () => {
  let rpc: jasmine.Spy;
  let insert: jasmine.Spy;
  let gateOk: boolean;
  let svc: CommentsService;

  beforeEach(() => {
    gateOk = true;
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: 3, error: null });
    insert = jasmine.createSpy('insert').and.resolveTo({ error: null });
    TestBed.configureTestingModule({
      providers: [
        CommentsService,
        { provide: SupabaseService, useValue: { client: { rpc, from: () => ({ insert }) } } },
        { provide: ProfileGateService, useValue: { ensure: () => Promise.resolve(gateOk) } },
      ],
    });
    svc = TestBed.inject(CommentsService);
  });

  it('counts the comments of a post with p_post', async () => {
    expect(await svc.count({ type: 'post', id: 'p1' })).toBe(3);
    expect(rpc).toHaveBeenCalledWith('comment_count', { p_post: 'p1' });
  });

  it('counts the comments of an event with p_event', async () => {
    await svc.count({ type: 'event', id: 'e1' });
    expect(rpc).toHaveBeenCalledWith('comment_count', { p_event: 'e1' });
  });

  it('answers null and stops asking when the SQL has not been run', async () => {
    rpc.and.resolveTo({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    expect(await svc.count({ type: 'post', id: 'p1' })).toBeNull();
    expect(await svc.count({ type: 'post', id: 'p2' })).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('answers null but asks again after a network error', async () => {
    rpc.and.resolveTo({ data: null, error: { code: '', message: 'Failed to fetch' } });
    expect(await svc.count({ type: 'post', id: 'p1' })).toBeNull();
    rpc.and.resolveTo({ data: 0, error: null });
    expect(await svc.count({ type: 'post', id: 'p1' })).toBe(0);
  });

  it('inserts trimmed text on the right column', async () => {
    expect(await svc.add({ type: 'event', id: 'e1' }, '  allí estaré  ')).toBeNull();
    expect(insert).toHaveBeenCalledWith({ event_id: 'e1', text: 'allí estaré' });
  });

  it('refuses empty and too long text without calling the database', async () => {
    expect(await svc.add({ type: 'post', id: 'p1' }, '   ')).toBeTruthy();
    expect(await svc.add({ type: 'post', id: 'p1' }, 'x'.repeat(501))).toContain('500');
    expect(insert).not.toHaveBeenCalled();
  });

  it('asks for a profile first', async () => {
    gateOk = false;
    expect(await svc.add({ type: 'post', id: 'p1' }, 'hola')).toBe(PROFILE_REQUIRED_MESSAGE);
    expect(insert).not.toHaveBeenCalled();
  });

  it('shows the rate-limit message from the database, and a generic one otherwise', async () => {
    insert.and.resolveTo({ error: { hint: 'rate_limit', message: 'Has publicado demasiado en poco tiempo.' } });
    expect(await svc.add({ type: 'post', id: 'p1' }, 'hola')).toBe('Has publicado demasiado en poco tiempo.');
    insert.and.resolveTo({ error: { hint: '', message: 'new row violates row-level security policy' } });
    expect(await svc.add({ type: 'post', id: 'p1' }, 'hola')).toBe('No se pudo publicar el comentario.');
  });
});
