import { readEmailLink } from './email-link';

describe('readEmailLink', () => {
  it('reads the token from links built in our own email templates', () => {
    expect(readEmailLink('?token_hash=pkce_abc123DEF456&type=recovery'))
      .toEqual({ tokenHash: 'pkce_abc123DEF456', type: 'recovery' });
    expect(readEmailLink('?type=signup&token_hash=abcdef0123456789')?.type).toBe('signup');
  });

  it('ignores other links so the older formats keep working', () => {
    expect(readEmailLink('?code=xyz')).toBeNull();
    expect(readEmailLink('')).toBeNull();
    expect(readEmailLink('?token_hash=abcdef0123456789&type=admin')).toBeNull();
    expect(readEmailLink('?token_hash=<script>&type=recovery')).toBeNull();
  });
});
