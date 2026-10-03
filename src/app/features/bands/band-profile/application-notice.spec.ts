import { applicationNoticeBody } from './application-notice';

describe('applicationNoticeBody', () => {
  it('names the musician and the instrument with its article', () => {
    expect(applicationNoticeBody('Ana García', 'Batería')).toBe('Ana García quiere tocar la batería en tu banda');
    expect(applicationNoticeBody('Luis', 'Bajo')).toBe('Luis quiere tocar el bajo en tu banda');
  });

  it('uses "cantar" for voice', () => {
    expect(applicationNoticeBody('Ana', 'Voz')).toBe('Ana quiere cantar en tu banda');
  });

  it('falls back to neutral wording without name or known instrument', () => {
    expect(applicationNoticeBody(null, 'Batería')).toBe('Alguien quiere tocar la batería en tu banda');
    expect(applicationNoticeBody('Ana', 'Otro')).toBe('Ana quiere unirse a tu banda');
    expect(applicationNoticeBody('  ', undefined)).toBe('Alguien quiere unirse a tu banda');
  });
});
