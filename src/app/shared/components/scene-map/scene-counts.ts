/** People and live ads per raw `city` value, from /api/counts (api/counts.js). */
export interface SceneCounts {
  musicians: Record<string, number>;
  bands: Record<string, number>;
  posts: Record<string, number>;
}

export interface PlaceCounts { musicians: number; bands: number; posts: number; total: number }

export type ActivityBucket = 'zero' | 'low' | 'mid' | 'high';

/** Tile color step for musicians + bands + posts: 0, 1–2, 3–9, 10+. */
export function activityBucket(total: number): ActivityBucket {
  return total >= 10 ? 'high' : total >= 3 ? 'mid' : total >= 1 ? 'low' : 'zero';
}

export function placeCounts(c: SceneCounts, place: string): PlaceCounts {
  const musicians = c.musicians[place] ?? 0, bands = c.bands[place] ?? 0, posts = c.posts[place] ?? 0;
  return { musicians, bands, posts, total: musicians + bands + posts };
}

const isCountMap = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(n => typeof n === 'number');

let pending: Promise<SceneCounts | null> | null = null;

/**
 * Fetched once per session; null when the API is missing (ng serve), down or returns anything odd.
 * A failure is not kept: the next map that mounts tries again.
 */
export function loadSceneCounts(): Promise<SceneCounts | null> {
  if (pending) return pending;
  const request: Promise<SceneCounts | null> = fetch('/api/counts')
    .then(r => r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null)
    .then(d => d && isCountMap(d.musicians) && isCountMap(d.bands) && isCountMap(d.posts)
      ? { musicians: d.musicians, bands: d.bands, posts: d.posts } as SceneCounts : null)
    .catch(() => null)
    .then(c => { if (!c && pending === request) pending = null; return c; });
  return pending = request;
}

/** Tests only: forget the cached request. */
export function resetSceneCounts(): void { pending = null; }
