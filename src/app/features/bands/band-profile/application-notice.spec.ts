import {
  applicationNoticeBody, applicationReviewedBody, applicationReviewedTitle, vacancyClosedTitle, VACANCY_CLOSED_BODY,
} from './application-notice';

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

describe('vacancy response copy', () => {
  it('names the instrument and the band when a vacancy closes', () => {
    expect(vacancyClosedTitle('Los Tests', 'Batería')).toBe('La vacante de batería en Los Tests se ha cerrado');
    expect(vacancyClosedTitle('Los Tests', '')).toBe('Una vacante en Los Tests se ha cerrado');
    expect(vacancyClosedTitle(null, 'Bajo')).toBe('La vacante de bajo en la banda se ha cerrado');
  });

  it('keeps the closing body kind and short', () => {
    expect(VACANCY_CLOSED_BODY).toBe('Gracias por tu interés. Hay más vacantes en Se busca.');
  });

  it('uses impersonal wording for a reviewed application', () => {
    expect(applicationReviewedTitle('Los Tests')).toBe('Han revisado tu solicitud en Los Tests');
    expect(applicationReviewedTitle('  ')).toBe('Han revisado tu solicitud');
    expect(applicationReviewedBody('Batería')).toBe('Vacante de batería');
    expect(applicationReviewedBody(null)).toBeUndefined();
  });
});
