import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EmailPrefsComponent } from './email-prefs.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';
import { ToastService } from '../../../core/services/toast.service';

describe('EmailPrefsComponent', () => {
  let stored: { email_messages: boolean } | null;
  let upsert: jasmine.Spy;
  let upsertError: object | null;
  let available: boolean;

  function create() {
    upsert = jasmine.createSpy('upsert').and.callFake(() => Promise.resolve({ error: upsertError }));
    TestBed.configureTestingModule({
      imports: [EmailPrefsComponent],
      providers: [
        { provide: SupabaseService, useValue: { client: { from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: stored, error: null }) }) }),
          upsert,
        }) } } },
        { provide: AuthService, useValue: { user: () => ({ id: 'u1' }) } },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(available), state: () => signal(available).asReadonly() } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
      ],
    });
    return TestBed.createComponent(EmailPrefsComponent).componentInstance;
  }

  beforeEach(() => { stored = null; upsertError = null; available = true; });

  it('is on by default when the user never chose', async () => {
    const c = create();
    await c.ngOnInit();
    expect(c.loaded()).toBeTrue();
    expect(c.emailMessages()).toBeTrue();
  });

  it('shows the saved choice and saves a change', async () => {
    stored = { email_messages: false };
    const c = create();
    await c.ngOnInit();
    expect(c.emailMessages()).toBeFalse();
    await c.save(true);
    expect(upsert.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ user_id: 'u1', email_messages: true }));
    expect(c.emailMessages()).toBeTrue();
  });

  it('rolls back when saving fails', async () => {
    upsertError = { message: 'x' };
    const c = create();
    await c.ngOnInit();
    await c.save(false);
    expect(c.emailMessages()).toBeTrue();
  });

  it('stays hidden while the table does not exist', async () => {
    available = false;
    const c = create();
    await c.ngOnInit();
    expect(c.loaded()).toBeFalse();
  });
});
