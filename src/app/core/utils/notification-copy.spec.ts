import { FAVORITE_NOTICE_TITLE, lessonRequestBody, LESSON_REQUEST_TITLE } from './notification-copy';

describe('notification copy', () => {
  it('never names who saved a profile', () => {
    expect(FAVORITE_NOTICE_TITLE).toBe('Alguien ha guardado tu perfil');
  });

  it('describes a lesson request with the date and points to the messages', () => {
    expect(LESSON_REQUEST_TITLE).toBe('Nueva solicitud de clase');
    expect(lessonRequestBody('Lola', 'martes, 7 de octubre de 2026'))
      .toBe('Lola quiere una clase el martes, 7 de octubre de 2026. Tienes los detalles en tus mensajes.');
    expect(lessonRequestBody(null, '')).toBe('Alguien quiere una clase contigo. Tienes los detalles en tus mensajes.');
  });
});
