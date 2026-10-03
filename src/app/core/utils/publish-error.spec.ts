import { publishErrorMessage } from './publish-error';

describe('publishErrorMessage', () => {
  it('shows the server anti-spam message as is', () => {
    expect(publishErrorMessage({ message: 'Has publicado demasiado en poco tiempo.', hint: 'rate_limit' }, 'x'))
      .toBe('Has publicado demasiado en poco tiempo.');
  });
  it('falls back to the generic copy for anything else', () => {
    expect(publishErrorMessage({ message: 'duplicate key', hint: null }, 'No se pudo publicar.')).toBe('No se pudo publicar.');
    expect(publishErrorMessage(null, 'No se pudo publicar.')).toBe('No se pudo publicar.');
  });
});
