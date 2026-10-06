import { ProfileGateService } from '../../../core/services/profile-gate.service';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { PostAlertsComponent, alertLabel } from './post-alerts.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { ToastService } from '../../../core/services/toast.service';

describe('PostAlertsComponent', () => {
  let rows: { id: string; city: string | null; instrument: string | null }[];
  let insertResult: { data: unknown; error: { code: string } | null };
  let insert: jasmine.Spy;
  let toast: jasmine.SpyObj<ToastService>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function client(): any {
    return {
      from: () => ({
        select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
        insert: (insert = jasmine.createSpy('insert').and.returnValue({ select: () => ({ single: () => Promise.resolve(insertResult) }) })),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
  }

  async function create(city = 'Madrid', instrument = 'Batería') {
    const session = signal<object | null>({ user: { id: 'u1' } });
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      imports: [PostAlertsComponent],
      providers: [
        { provide: ProfileGateService, useValue: { ensure: () => Promise.resolve(true) } },
        { provide: SupabaseService, useValue: { client: client() } },
        { provide: AuthService, useValue: { isLoggedIn: computed(() => !!session()), user: computed(() => (session() ? { id: 'u1' } : null)) } },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(true), state: () => signal(true).asReadonly() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(PostAlertsComponent);
    fixture.componentRef.setInput('city', city);
    fixture.componentRef.setInput('instrument', instrument);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(r => setTimeout(r));
    return fixture.componentInstance;
  }

  beforeEach(() => {
    rows = [];
    insertResult = { data: { id: 'a1', city: 'Madrid', instrument: 'Batería' }, error: null };
  });

  it('labels alerts in plain words', () => {
    expect(alertLabel({ city: 'Madrid', instrument: 'Batería' })).toBe('Batería · Madrid');
    expect(alertLabel({ city: null, instrument: null })).toBe('Cualquier anuncio · toda España');
  });

  it('turns the current filters into an alert ("Toda España" and no instrument = any)', async () => {
    const c = await create('Toda España', '');
    expect(c.current()).toEqual({ city: null, instrument: null });
    expect(c.canCreate()).toBeFalse();
    await c.add();
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates the alert for the current filters', async () => {
    const c = await create();
    await c.add();
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', city: 'Madrid', instrument: 'Batería' });
    expect(c.currentAlert()?.id).toBe('a1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('explains the 5-alert limit', async () => {
    insertResult = { data: null, error: { code: 'P0001' } };
    const c = await create();
    await c.add();
    expect(toast.error.calls.mostRecent().args[0]).toContain('hasta 5 alertas');
    expect(c.alerts().length).toBe(0);
  });

  it('recognises an existing alert for the current filters', async () => {
    rows = [{ id: 'x', city: 'Madrid', instrument: 'Batería' }, { id: 'y', city: null, instrument: 'Bajo' }];
    const c = await create();
    expect(c.currentAlert()?.id).toBe('x');
    expect(c.others().map(a => a.id)).toEqual(['y']);
    await c.remove(c.currentAlert()!);
    expect(c.alerts().map(a => a.id)).toEqual(['y']);
  });
});
