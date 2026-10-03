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

  it('reports a feature as available when the probe succeeds, and caches it for the session', async () => {
    results.push({ data: [], error: null });
    expect(await svc.has('eventImage')).toBeTrue();
    expect(await svc.has('eventImage')).toBeTrue();
    expect(from).toHaveBeenCalledOnceWith('events');
    expect(select).toHaveBeenCalledOnceWith('image_url');
    expect(svc.state('eventImage')()).toBeTrue();
  });

  it('reports "not available" before the SQL is run (42703 undefined column) and caches it', async () => {
    results.push({ data: null, error: { code: '42703', message: 'column venues.photos does not exist' } });
    expect(await svc.has('venuePhotos')).toBeFalse();
    expect(await svc.has('venuePhotos')).toBeFalse();
    expect(from).toHaveBeenCalledOnceWith('venues');
    expect(select).toHaveBeenCalledOnceWith('photos');
    expect(svc.state('venuePhotos')()).toBeFalse();
  });

  it('treats other errors as "not available for now" and retries next time', async () => {
    results.push({ data: null, error: { code: 'PGRST000', message: 'network' } });
    expect(await svc.has('rehearsalPhotos')).toBeFalse();
    results.push({ data: [], error: null });
    expect(await svc.has('rehearsalPhotos')).toBeTrue();
    expect(from.calls.allArgs()).toEqual([['rehearsal_spaces'], ['rehearsal_spaces']]);
  });

  it('never throws when the client itself fails', async () => {
    from.and.throwError('offline');
    expect(await svc.has('eventImage')).toBeFalse();
  });

  it('probes each feature independently', async () => {
    results.push({ data: [], error: null }, { data: null, error: { code: '42703' } });
    expect(await svc.has('eventImage')).toBeTrue();
    expect(await svc.has('venuePhotos')).toBeFalse();
  });
});
