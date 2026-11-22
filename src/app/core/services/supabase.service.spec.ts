import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService captcha options', () => {
  let service: SupabaseService;
  const ok = Promise.resolve({ data: {}, error: null });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupabaseService] });
    service = TestBed.inject(SupabaseService);
  });

  describe('signInWithEmail()', () => {
    it('sends exactly email + password when there is no token (captcha off)', async () => {
      const spy = spyOn(service.auth, 'signInWithPassword').and.returnValue(ok as never);
      await service.signInWithEmail('a@b.com', 'pw');
      expect(spy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    });

    it('adds options.captchaToken when a token is given', async () => {
      const spy = spyOn(service.auth, 'signInWithPassword').and.returnValue(ok as never);
      await service.signInWithEmail('a@b.com', 'pw', 'tok');
      expect(spy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', options: { captchaToken: 'tok' } });
    });
  });

  describe('signUpWithEmail()', () => {
    it('keeps options undefined with no metadata and no token', async () => {
      const spy = spyOn(service.auth, 'signUp').and.returnValue(ok as never);
      await service.signUpWithEmail('a@b.com', 'pw');
      expect(spy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', options: undefined });
    });

    it('sends only metadata when there is no token', async () => {
      const spy = spyOn(service.auth, 'signUp').and.returnValue(ok as never);
      await service.signUpWithEmail('a@b.com', 'pw', { age_confirmed: true });
      expect(spy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', options: { data: { age_confirmed: true } } });
    });

    it('sends metadata and captchaToken together', async () => {
      const spy = spyOn(service.auth, 'signUp').and.returnValue(ok as never);
      await service.signUpWithEmail('a@b.com', 'pw', { age_confirmed: true }, 'tok');
      expect(spy).toHaveBeenCalledWith({
        email: 'a@b.com', password: 'pw',
        options: { data: { age_confirmed: true }, captchaToken: 'tok' },
      });
    });
  });

  describe('resetPasswordForEmail()', () => {
    const redirectTo = `${window.location.origin}/auth/callback`;

    it('omits captchaToken when there is no token', async () => {
      const spy = spyOn(service.auth, 'resetPasswordForEmail').and.returnValue(ok as never);
      await service.resetPasswordForEmail('a@b.com');
      expect(spy).toHaveBeenCalledWith('a@b.com', { redirectTo });
    });

    it('adds captchaToken when a token is given', async () => {
      const spy = spyOn(service.auth, 'resetPasswordForEmail').and.returnValue(ok as never);
      await service.resetPasswordForEmail('a@b.com', 'tok');
      expect(spy).toHaveBeenCalledWith('a@b.com', { redirectTo, captchaToken: 'tok' });
    });
  });
});
