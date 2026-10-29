import { TestBed } from '@angular/core/testing';
import { MediaFeaturesService } from './media-features.service';
import { SupabaseService } from './supabase.service';

type ProbeResult = { data: unknown; error: { code?: string; message?: string } | null };

describe('MediaFeaturesService', () => {
  let svc: MediaFeaturesService;
  let from: jasmine.Spy;
  let select: jasmine.Spy;
  let results: ProbeResult[];

  beforeEach(() => {
    results = [];
    select = jasmine.createSpy('select').and.callFake(() => ({
      limit: () => Promise.resolve(results.shift() ?? { data: [], error: null }),
    }));
    from = jasmine.createSpy('from').and.returnValue({ select });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { from } } }] });
    svc = TestBed.inject(MediaFeaturesService);
  });

  it('answers features whose SQL is confirmed run without any request', async () => {
    expect(svc.state('eventImage')()).toBeTrue();
    expect(await svc.has('eventImage')).toBeTrue();
    expect(await svc.has('bandInvites')).toBeTrue();
    expect(from).not.toHaveBeenCalled();
  });

  it('reports a feature as available when the probe succeeds, and caches it for the session', async () => {
    results.push({ data: [], error: null });
    expect(await svc.has('postAlerts')).toBeTrue();
    expect(await svc.has('postAlerts')).toBeTrue();
    expect(from).toHaveBeenCalledOnceWith('post_alerts');
    expect(select).toHaveBeenCalledOnceWith('id');
    expect(svc.state('postAlerts')()).toBeTrue();
  });

  it('reports "not available" before the SQL is run (42P01 undefined table) and caches it', async () => {
    results.push({ data: null, error: { code: '42P01', message: 'relation notification_prefs does not exist' } });
    expect(await svc.has('emailPrefs')).toBeFalse();
    expect(await svc.has('emailPrefs')).toBeFalse();
    expect(from).toHaveBeenCalledOnceWith('notification_prefs');
    expect(select).toHaveBeenCalledOnceWith('user_id');
    expect(svc.state('emailPrefs')()).toBeFalse();
  });

  it('treats other errors (e.g. signed out: permission denied) as "not available for now" and retries next time', async () => {
    results.push({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect(await svc.has('postAlerts')).toBeFalse();
    results.push({ data: [], error: null });
    expect(await svc.has('postAlerts')).toBeTrue();
    expect(from.calls.allArgs()).toEqual([['post_alerts'], ['post_alerts']]);
  });

  it('never throws when the client itself fails', async () => {
    from.and.throwError('offline');
    expect(await svc.has('emailPrefs')).toBeFalse();
  });

  it('probes each feature independently', async () => {
    results.push({ data: [], error: null }, { data: null, error: { code: '42P01' } });
    expect(await svc.has('postAlerts')).toBeTrue();
    expect(await svc.has('emailPrefs')).toBeFalse();
  });
});
