import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProfileGateService, PROFILE_REQUIRED_MESSAGE } from './profile-gate.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

describe('ProfileGateService', () => {
  let role: string | null;
  let session: object | null;
  let navigate: jasmine.Spy;
  let toast: jasmine.SpyObj<ToastService>;
  let profileReads: number;

  function create() {
    profileReads = 0;
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    toast = jasmine.createSpyObj('ToastService', ['error']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = { select: () => b, eq: () => b, maybeSingle: () => { profileReads++; return Promise.resolve({ data: role ? { id: 'u1', role } : null, error: null }); } };
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { auth: { getSession: () => Promise.resolve({ data: { session } }) }, client: { from: () => b } } },
        { provide: Router, useValue: { navigate } },
        { provide: ToastService, useValue: toast },
      ],
    });
    return TestBed.inject(ProfileGateService);
  }

  beforeEach(() => { session = { user: { id: 'u1' } }; role = null; });

  it('sends accounts without a profile to onboarding with a clear message', async () => {
    const gate = create();
    expect(await gate.ensure()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith(PROFILE_REQUIRED_MESSAGE);
    expect(navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('can stay quiet when the caller shows its own message', async () => {
    const gate = create();
    expect(await gate.ensure({ toast: false })).toBeFalse();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('lets people with a profile through and remembers it', async () => {
    role = 'listener';
    const gate = create();
    expect(await gate.ensure()).toBeTrue();
    expect(await gate.ensure()).toBeTrue();
    expect(profileReads).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing for signed-out visitors (login flows handle them)', async () => {
    session = null;
    const gate = create();
    expect(await gate.ensure()).toBeTrue();
    expect(profileReads).toBe(0);
  });
});
