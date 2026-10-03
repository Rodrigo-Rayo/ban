import { TestBed } from '@angular/core/testing';
import { gearConditionLabel, gearConditionValues, GEAR_CONDITION_FORM_OPTIONS } from '../constants/gear';
import { formatShortDate, formatLongDate, formatTime, dateParts } from './date';
import { askLabel, askStampClass, sinceISO, SE_BUSCA_PERIODS, SE_BUSCA_MAX_DAYS } from './se-busca';
import { timeAgo } from './display.utils';
import { ConfirmService } from '../services/confirm.service';
import { AvatarUploadService } from '../services/avatar-upload.service';
import { SupabaseService } from '../services/supabase.service';
import { ToastService } from '../services/toast.service';

describe('gear conditions', () => {
  it('labels English ids and legacy Spanish values the same way', () => {
    expect(gearConditionLabel('good')).toBe('Bueno');
    expect(gearConditionLabel('bueno')).toBe('Bueno');
    expect(gearConditionLabel('muy bueno')).toBe('Muy bueno');
    expect(gearConditionLabel('como nuevo')).toBe('Como nuevo');
  });
  it('filters by every stored alias', () => {
    expect(gearConditionValues('good')).toEqual(['good', 'bueno']);
    expect(gearConditionValues('like_new')).toEqual(['like_new', 'como nuevo']);
  });
  it('does not offer legacy-only values in the form', () => {
    expect(GEAR_CONDITION_FORM_OPTIONS.map(c => c.id)).not.toContain('very_good');
  });
});

describe('date formatting', () => {
  const now = new Date(2026, 9, 2);
  it('short date omits the current year', () => {
    expect(formatShortDate('2026-08-21', now)).toBe('21 ago');
    expect(formatShortDate('2025-08-21', now)).toBe('21 ago 2025');
  });
  it('long date reads naturally', () => {
    expect(formatLongDate('2026-08-21')).toBe('viernes, 21 de agosto de 2026');
  });
  it('time without seconds or trailing h', () => {
    expect(formatTime('21:00:00')).toBe('21:00');
    expect(formatTime('9:05')).toBe('09:05');
  });
  it('date parts for poster blocks', () => {
    expect(dateParts('2026-08-21')).toEqual({ weekday: 'vie', day: '21', month: 'ago' });
  });
});

describe('Se busca stamps', () => {
  it('yellow means looking for, ink means offering', () => {
    expect(askStampClass('musician_seeking_band')).toBe('tag-accent');
    expect(askStampClass('vacancy')).toBe('tag-accent');
    expect(askStampClass('session_offer')).toBe('tag-night');
  });
  it('labels say what is wanted', () => {
    expect(askLabel('vacancy', 'Batería')).toBe('Busca batería');
    expect(askLabel('musician_seeking_band')).toBe('Busca banda');
  });
});

describe('Se busca age window', () => {
  it('sinceISO goes back the given number of days', () => {
    expect(sinceISO(7, new Date('2026-10-10T12:00:00Z'))).toBe('2026-10-03T12:00:00.000Z');
  });
  it('the longest period is the three-month maximum', () => {
    expect(SE_BUSCA_PERIODS.at(-1)!.days).toBe(SE_BUSCA_MAX_DAYS);
    expect(SE_BUSCA_MAX_DAYS).toBe(90);
  });
});

describe('timeAgo', () => {
  it('spells minutes out so "1m" is not read as one month', () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe('hace 5 min');
  });
});

describe('ConfirmService', () => {
  it('resolves with the user choice and closes', async () => {
    const svc = new ConfirmService();
    const answer = svc.ask({ title: '¿Eliminar?' });
    expect(svc.pending()?.title).toBe('¿Eliminar?');
    svc.settle(true);
    expect(await answer).toBeTrue();
    expect(svc.pending()).toBeNull();
  });
  it('a new question cancels the previous one', async () => {
    const svc = new ConfirmService();
    const first = svc.ask({ title: 'A' });
    svc.ask({ title: 'B' });
    expect(await first).toBeFalse();
  });
});

describe('AvatarUploadService', () => {
  let toast: jasmine.SpyObj<ToastService>;
  let svc: AvatarUploadService;
  const file = (type: string, size = 1000) => new File([new Uint8Array(size)], 'a', { type });

  beforeEach(() => {
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({ providers: [
      { provide: ToastService, useValue: toast },
      { provide: SupabaseService, useValue: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } } },
    ] });
    svc = TestBed.inject(AvatarUploadService);
  });

  it('rejects unsupported types (e.g. iPhone HEIC) with a clear message', async () => {
    expect(await svc.upload(file('image/heic'))).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Usa una imagen JPG, PNG o WebP.');
  });
  it('rejects files over 5 MB', async () => {
    expect(await svc.upload(file('image/png', 6 * 1024 * 1024))).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('La imagen no puede superar 5 MB.');
  });
  it('asks to sign in when there is no session', async () => {
    expect(await svc.upload(file('image/png'))).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Inicia sesión para cambiar tu foto.');
  });
});
