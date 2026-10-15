import { TestBed } from '@angular/core/testing';
import { BandInvitesService, inviteMessage, inviteUrl, isInviteToken, whatsappUrl } from './band-invites.service';
import { SupabaseService } from './supabase.service';

const TOKEN = 'a'.repeat(64);

describe('band invite helpers', () => {
  it('accepts only 64-hex tokens', () => {
    expect(isInviteToken(TOKEN)).toBeTrue();
    expect(isInviteToken('A'.repeat(64))).toBeFalse();
    expect(isInviteToken('abc')).toBeFalse();
    expect(isInviteToken(null)).toBeFalse();
  });

  it('builds the /unirse link', () => {
    expect(inviteUrl(TOKEN, 'https://www.bandyou.es')).toBe(`https://www.bandyou.es/unirse/${TOKEN}`);
  });

  it('says plainly that a musician profile is needed', () => {
    const text = inviteMessage('Los Perros', 'Carlos', 'Batería', 'https://x/unirse/t');
    expect(text).toContain('¡Hola, Carlos!');
    expect(text).toContain('Los Perros como batería');
    expect(text).toContain('crea tu perfil de músico');
    expect(text).toContain('si ya tienes uno, solo tienes que aceptar');
    expect(text.endsWith('https://x/unirse/t')).toBeTrue();
    expect(inviteMessage('Los Perros', ' ', null, 'u')).toContain('¡Hola! Te he añadido a Los Perros en BandYou');
  });

  it('opens WhatsApp with the text encoded', () => {
    expect(whatsappUrl('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
  });
});

describe('BandInvitesService', () => {
  let svc: BandInvitesService;
  let rpc: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    TestBed.configureTestingModule({
      providers: [BandInvitesService, { provide: SupabaseService, useValue: { client: { rpc } } }],
    });
    svc = TestBed.inject(BandInvitesService);
    localStorage.removeItem('bandyou_invite');
  });

  afterEach(() => localStorage.removeItem('bandyou_invite'));

  it('keeps the opened invite for 14 days', () => {
    const now = Date.now();
    svc.rememberPending(TOKEN);
    expect(svc.pending(now)).toBe(TOKEN);
    expect(svc.pending(now + 15 * 864e5)).toBeNull();
    expect(localStorage.getItem('bandyou_invite')).toBeNull();
  });

  it('ignores a broken or tampered stored invite', () => {
    localStorage.setItem('bandyou_invite', '{broken');
    expect(svc.pending()).toBeNull();
    localStorage.setItem('bandyou_invite', JSON.stringify({ token: '../evil', at: Date.now() }));
    expect(svc.pending()).toBeNull();
  });

  it('maps accept errors to their codes', async () => {
    rpc.and.resolveTo({ data: null, error: { message: 'need_musician' } });
    expect(await svc.accept(TOKEN)).toEqual({ error: 'need_musician' });
    rpc.and.resolveTo({ data: null, error: { message: 'something odd' } });
    expect(await svc.accept(TOKEN)).toEqual({ error: 'error' });
    rpc.and.resolveTo({ data: 'band-1', error: null });
    expect(await svc.accept(TOKEN)).toEqual({ bandId: 'band-1' });
  });

  it('turns create errors into messages', async () => {
    rpc.and.resolveTo({ data: null, error: { message: 'too_many_invites' } });
    expect(await svc.create('m1')).toEqual({ error: 'Has enviado muchas invitaciones hoy. Prueba mañana.' });
    rpc.and.resolveTo({ data: TOKEN, error: null });
    const r = await svc.create('m1');
    expect('url' in r && r.url.endsWith('/unirse/' + TOKEN)).toBeTrue();
  });

  it('does not call the server for a malformed token', async () => {
    expect(await svc.info('nope')).toEqual({ status: 'invalid' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
