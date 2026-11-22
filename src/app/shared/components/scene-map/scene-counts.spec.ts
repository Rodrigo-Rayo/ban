import { activityBucket, loadSceneCounts, placeCounts, resetSceneCounts } from './scene-counts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('scene counts', () => {
  afterEach(() => resetSceneCounts());

  it('buckets totals as 0, 1–2, 3–9 and 10+', () => {
    expect(activityBucket(0)).toBe('zero');
    expect(activityBucket(1)).toBe('low');
    expect(activityBucket(2)).toBe('low');
    expect(activityBucket(3)).toBe('mid');
    expect(activityBucket(9)).toBe('mid');
    expect(activityBucket(10)).toBe('high');
    expect(activityBucket(250)).toBe('high');
  });

  it('adds up one place and treats missing places as zero', () => {
    const c = { musicians: { Madrid: 3 }, bands: { Madrid: 1 }, posts: {} };
    expect(placeCounts(c, 'Madrid')).toEqual({ musicians: 3, bands: 1, posts: 0, total: 4 });
    expect(placeCounts(c, 'Soria').total).toBe(0);
  });

  it('fetches once per session', async () => {
    const spy = spyOn(window, 'fetch').and.resolveTo(json({ musicians: {}, bands: {}, posts: {} }));
    await loadSceneCounts();
    await loadSceneCounts();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('/api/counts');
  });

  it('returns null for the SPA fallback page (ng serve), errors and odd JSON', async () => {
    spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })),
      Promise.resolve(json({}, 500)),
      Promise.reject(new TypeError('offline')),
      Promise.resolve(json({ musicians: { Madrid: 'x' }, bands: {}, posts: {} })),
    );
    for (let i = 0; i < 4; i++) {
      resetSceneCounts();
      expect(await loadSceneCounts()).toBeNull();
    }
  });
});
