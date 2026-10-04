import { needsOnboarding } from './profile-check';

/** Fake client: `rows` maps a table to what `.maybeSingle()` resolves to. */
function client(rows: Record<string, { data: unknown; error?: unknown }>) {
  const from = jasmine.createSpy('from').and.callFake((table: string) => {
    const b: any = {};
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = () => Promise.resolve({ error: null, ...(rows[table] ?? { data: null }) });
    return b;
  });
  return { from } as any;
}

describe('needsOnboarding', () => {
  it('requires onboarding when the account has no role', async () => {
    expect(await needsOnboarding(client({ profiles: { data: { role: null } } }), 'u')).toBeTrue();
    expect(await needsOnboarding(client({ profiles: { data: null } }), 'u')).toBeTrue();
  });

  it('accepts a listener without any profile-type row', async () => {
    const c = client({ profiles: { data: { role: 'listener' } } });
    expect(await needsOnboarding(c, 'u')).toBeFalse();
    expect(c.from).toHaveBeenCalledTimes(1);
  });

  it('accepts a role whose profile row exists', async () => {
    const c = client({ profiles: { data: { role: 'band' } }, bands: { data: { id: 'b' } } });
    expect(await needsOnboarding(c, 'u')).toBeFalse();
    expect(c.from).toHaveBeenCalledTimes(2);
  });

  it('requires onboarding when the role has no profile row anywhere', async () => {
    expect(await needsOnboarding(client({ profiles: { data: { role: 'musician' } } }), 'u')).toBeTrue();
  });

  it('accepts a profile row in another table when the role is out of sync', async () => {
    const c = client({ profiles: { data: { role: 'musician' } }, teachers: { data: { id: 't' } } });
    expect(await needsOnboarding(c, 'u')).toBeFalse();
  });

  it('returns null when a lookup fails', async () => {
    expect(await needsOnboarding(client({ profiles: { data: null, error: { message: 'x' } } }), 'u')).toBeNull();
    expect(await needsOnboarding(client({
      profiles: { data: { role: 'venue' } }, venues: { data: null, error: { message: 'x' } },
    }), 'u')).toBeNull();
  });
});
